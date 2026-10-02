/**
 * Deposits (BLUEPRINT 8 "Stripe webhook events", Phase 7). A deposit never confirms a booking —
 * the team still calls. Rules:
 *  - `paid` always wins (overrides pending/expired), and is applied once (idempotent).
 *  - `expired` only replaces `pending`.
 *  - refunds are recorded from Stripe's own totals, so replays are harmless.
 */
import { and, eq, lt } from "drizzle-orm";
import { auditInsert, readSetting } from "@/lib/audit";
import type { Db } from "@/lib/db/client";
import { newId, nowIso } from "@/lib/db/ids";
import { bookings, customers, messages } from "@/lib/db/schema";
import { formatCents } from "@/lib/money";
import { bookingTemplateVars, ownerTargets, SERVICE_LABELS } from "@/lib/notify/alerts";
import { sendTemplate, type NotifyContext } from "@/lib/notify/deliver";
import { isInQuietHours } from "@/lib/time";
import {
  createDepositCheckout,
  createRefund,
  retrieveCheckoutSession,
  type CheckoutSession,
  type StripeEvent,
} from "@/lib/stripe";

export type StripeConfig = { secretKey: string; siteUrl: string; fetchImpl?: typeof fetch };

const CHECKOUT_MINUTES = 60;

async function note(db: Db, bookingId: string, body: string) {
  await db.insert(messages).values({
    id: newId(),
    bookingId,
    direction: "note",
    channel: "note",
    body,
    sentBy: "system",
    status: "sent",
    createdAt: nowIso(),
  });
}

async function alertOwners(
  ctx: NotifyContext,
  bookingId: string,
  key: "owner_deposit_paid_sms" | "owner_deposit_expired_sms",
) {
  try {
    const [row] = await ctx.db
      .select({ b: bookings, phone: customers.phone })
      .from(bookings)
      .innerJoin(customers, eq(customers.id, bookings.bookerCustomerId))
      .where(eq(bookings.id, bookingId))
      .limit(1);
    if (!row) return;
    const [business, bookingSettings] = await Promise.all([
      readSetting(ctx.db, "business"),
      readSetting(ctx.db, "booking"),
    ]);
    const { notifications, smsPhones } = await ownerTargets(ctx);
    if (isInQuietHours(new Date(), notifications.quietHours)) return;
    const vars = bookingTemplateVars(row.b, row.phone, business, bookingSettings);
    await Promise.all(smsPhones.map((to) => sendTemplate(ctx, key, vars, { bookingId, to })));
  } catch (e) {
    console.error("deposit alert failed", e);
  }
}

/** Starts Stripe Checkout for a booking's deposit. Returns the URL, or null if it couldn't (booking stays "pay later"). */
export async function startDeposit(
  db: Db,
  bookingId: string,
  stripe: StripeConfig | null,
  now: Date = new Date(),
): Promise<string | null> {
  const [b] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  if (!b) return null;
  if (b.depositStatus === "paid") return null;
  const settings = await readSetting(db, "booking");
  if (!settings.depositEnabled || settings.depositAmountCents <= 0) return null;
  if (!stripe) {
    await note(
      db,
      b.id,
      "Customer chose to pay a deposit, but online payments aren't set up (STRIPE_SECRET_KEY). Take payment on the call.",
    );
    return null;
  }
  try {
    const session = await createDepositCheckout(
      stripe.secretKey,
      {
        bookingId: b.id,
        ref: b.ref,
        amountCents: settings.depositAmountCents,
        description: `Deposit — ${SERVICE_LABELS[b.service] ?? "clean"} (${b.ref})`,
        customerEmail: b.submittedEmail,
        siteUrl: stripe.siteUrl,
        expiresAt: new Date(now.getTime() + CHECKOUT_MINUTES * 60_000),
      },
      stripe.fetchImpl,
    );
    await db.batch([
      db
        .update(bookings)
        .set({
          paymentChoice: "deposit",
          depositStatus: "pending",
          depositCents: settings.depositAmountCents,
          stripeSessionId: session.id,
          updatedAt: nowIso(now),
        })
        .where(eq(bookings.id, b.id)),
      auditInsert(db, {
        actorEmail: "system",
        action: "update",
        entity: "booking",
        entityId: b.id,
        before: { depositStatus: b.depositStatus },
        after: { depositStatus: "pending", stripeSessionId: session.id },
      }),
    ]);
    return session.url;
  } catch (e) {
    console.error("Stripe checkout failed", e);
    await note(
      db,
      b.id,
      `Deposit checkout couldn't start (${e instanceof Error ? e.message : "error"}). Take payment on the call.`,
    );
    return null;
  }
}

async function bookingForSession(
  db: Db,
  session: Pick<CheckoutSession, "id" | "metadata" | "client_reference_id">,
) {
  const id = session.metadata?.bookingId ?? session.client_reference_id;
  const where = id ? eq(bookings.id, id) : eq(bookings.stripeSessionId, session.id);
  const [b] = await db.select().from(bookings).where(where).limit(1);
  return b ?? null;
}

export async function applySessionCompleted(
  ctx: NotifyContext,
  session: CheckoutSession,
): Promise<string> {
  const b = await bookingForSession(ctx.db, session);
  if (!b) return "no booking";
  if (session.payment_status !== "paid") return "not paid yet";
  if (
    b.depositStatus === "paid" ||
    b.depositStatus === "refunded" ||
    b.depositStatus === "partially_refunded"
  )
    return "already recorded";
  await ctx.db.batch([
    ctx.db
      .update(bookings)
      .set({
        depositStatus: "paid",
        paidMethod: "stripe",
        depositCents: session.amount_total ?? b.depositCents,
        stripeSessionId: session.id,
        stripePaymentIntentId: session.payment_intent,
        updatedAt: nowIso(),
      })
      .where(eq(bookings.id, b.id)),
    auditInsert(ctx.db, {
      actorEmail: "stripe",
      action: "update",
      entity: "booking",
      entityId: b.id,
      before: { depositStatus: b.depositStatus },
      after: { depositStatus: "paid", amount: session.amount_total },
    }),
  ]);
  await note(
    ctx.db,
    b.id,
    `Deposit of ${formatCents(session.amount_total ?? b.depositCents ?? 0)} paid by card (Stripe).`,
  );
  await alertOwners(ctx, b.id, "owner_deposit_paid_sms");
  return "paid";
}

export async function applySessionExpired(
  ctx: NotifyContext,
  session: CheckoutSession,
): Promise<string> {
  const b = await bookingForSession(ctx.db, session);
  if (!b) return "no booking";
  if (b.depositStatus !== "pending" || (b.stripeSessionId && b.stripeSessionId !== session.id))
    return "ignored";
  await ctx.db.batch([
    ctx.db
      .update(bookings)
      .set({ depositStatus: "expired", updatedAt: nowIso() })
      .where(eq(bookings.id, b.id)),
    auditInsert(ctx.db, {
      actorEmail: "stripe",
      action: "update",
      entity: "booking",
      entityId: b.id,
      before: { depositStatus: "pending" },
      after: { depositStatus: "expired" },
    }),
  ]);
  await note(ctx.db, b.id, "Deposit checkout expired without payment — call to confirm.");
  await alertOwners(ctx, b.id, "owner_deposit_expired_sms");
  return "expired";
}

export async function applyChargeRefunded(
  ctx: NotifyContext,
  charge: { payment_intent?: unknown; amount?: unknown; amount_refunded?: unknown },
): Promise<string> {
  const pi = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
  if (!pi) return "no payment intent";
  const [b] = await ctx.db
    .select()
    .from(bookings)
    .where(eq(bookings.stripePaymentIntentId, pi))
    .limit(1);
  if (!b) return "no booking";
  const refunded = Number(charge.amount_refunded ?? 0);
  const amount = Number(charge.amount ?? b.depositCents ?? 0);
  const status =
    refunded >= amount ? "refunded" : refunded > 0 ? "partially_refunded" : b.depositStatus;
  if (b.refundedCents === refunded && b.depositStatus === status) return "already recorded";
  await ctx.db.batch([
    ctx.db
      .update(bookings)
      .set({ refundedCents: refunded, depositStatus: status, updatedAt: nowIso() })
      .where(eq(bookings.id, b.id)),
    auditInsert(ctx.db, {
      actorEmail: "stripe",
      action: "update",
      entity: "booking",
      entityId: b.id,
      before: { depositStatus: b.depositStatus, refundedCents: b.refundedCents },
      after: { depositStatus: status, refundedCents: refunded },
    }),
  ]);
  return status;
}

export async function handleStripeEvent(ctx: NotifyContext, event: StripeEvent): Promise<string> {
  const obj = event.data.object;
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      return applySessionCompleted(ctx, obj as unknown as CheckoutSession);
    case "checkout.session.expired":
      return applySessionExpired(ctx, obj as unknown as CheckoutSession);
    case "charge.refunded":
      return applyChargeRefunded(ctx, obj);
    default:
      return "ignored";
  }
}

/** Admin refund (full or partial). The webhook later confirms the same totals. */
export async function refundDeposit(
  ctx: NotifyContext,
  ref: string,
  amountCents: number,
  actorEmail: string,
  stripe: StripeConfig | null,
): Promise<{ ok: boolean; message: string }> {
  const [b] = await ctx.db.select().from(bookings).where(eq(bookings.ref, ref)).limit(1);
  if (!b) return { ok: false, message: "Booking not found" };
  if (!stripe) return { ok: false, message: "Stripe isn't set up." };
  if (
    !b.stripePaymentIntentId ||
    (b.depositStatus !== "paid" && b.depositStatus !== "partially_refunded")
  )
    return { ok: false, message: "There's no card deposit to refund." };
  const refundable = (b.depositCents ?? 0) - b.refundedCents;
  if (!Number.isInteger(amountCents) || amountCents <= 0 || amountCents > refundable)
    return { ok: false, message: `Enter an amount up to ${formatCents(refundable)}.` };
  try {
    const refund = await createRefund(
      stripe.secretKey,
      b.stripePaymentIntentId,
      amountCents,
      `refund-${b.id}-${b.refundedCents}-${amountCents}`,
      stripe.fetchImpl,
    );
    const total = b.refundedCents + refund.amount;
    const status = total >= (b.depositCents ?? 0) ? "refunded" : "partially_refunded";
    await ctx.db.batch([
      ctx.db
        .update(bookings)
        .set({ refundedCents: total, depositStatus: status, updatedAt: nowIso() })
        .where(eq(bookings.id, b.id)),
      auditInsert(ctx.db, {
        actorEmail,
        action: "update",
        entity: "booking",
        entityId: b.id,
        before: { depositStatus: b.depositStatus, refundedCents: b.refundedCents },
        after: { depositStatus: status, refundedCents: total, refundId: refund.id },
      }),
    ]);
    await note(
      ctx.db,
      b.id,
      `Refunded ${formatCents(refund.amount)} to the customer's card (by ${actorEmail}).`,
    );
    return {
      ok: true,
      message: `Refunded ${formatCents(refund.amount)}. It takes 5–10 business days to reach the card.`,
    };
  } catch (e) {
    return {
      ok: false,
      message: `Stripe refused the refund: ${e instanceof Error ? e.message : "error"}`,
    };
  }
}

/** Nightly safety net: asks Stripe about deposits still pending after 2 h (missed webhooks). */
export async function depositSafetyNet(
  ctx: NotifyContext,
  stripe: StripeConfig | null,
  now: Date = new Date(),
): Promise<string> {
  if (!stripe) return "deposits: Stripe not configured";
  const cutoff = new Date(now.getTime() - 2 * 3600_000).toISOString();
  const pending = await ctx.db
    .select()
    .from(bookings)
    .where(and(eq(bookings.depositStatus, "pending"), lt(bookings.updatedAt, cutoff)));
  let fixed = 0;
  for (const b of pending) {
    if (!b.stripeSessionId) continue;
    try {
      const s = await retrieveCheckoutSession(
        stripe.secretKey,
        b.stripeSessionId,
        stripe.fetchImpl,
      );
      if (s.status === "complete" && s.payment_status === "paid") {
        if ((await applySessionCompleted(ctx, s)) === "paid") fixed++;
      } else if (s.status === "expired") {
        if ((await applySessionExpired(ctx, s)) === "expired") fixed++;
      }
    } catch (e) {
      console.error(`safety net: ${b.ref}`, e);
    }
  }
  return `deposits: checked ${pending.length}, fixed ${fixed}`;
}
