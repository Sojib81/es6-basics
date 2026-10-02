import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { adminUsers, bookings, messages, settings } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/lib/db/test-db";
import type { NotifyContext } from "@/lib/notify/deliver";
import type { CheckoutSession } from "@/lib/stripe";
import { TURNSTILE_DUMMY_TOKEN } from "@/lib/turnstile";
import { depositSafetyNet, handleStripeEvent, refundDeposit, type StripeConfig } from "./deposits";
import { handleBookingRequest, type PublicDeps } from "./handle-public";

let t: TestDb;
let ctx: NotifyContext;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.dispose());
beforeEach(async () => {
  await t.reset();
  await t.seed();
  await t.db.update(adminUsers).set({ smsPhone: "+61400111222" });
  const [row] = await t.db.select().from(settings).where(eq(settings.key, "booking"));
  await t.db
    .update(settings)
    .set({ value: { ...(row.value as object), depositEnabled: true, depositAmountCents: 5000 } })
    .where(eq(settings.key, "booking"));
  ctx = { db: t.db, mode: "log", email: {}, sms: null };
});

const now = new Date("2026-10-05T01:00:00Z");
const fakeStripe = (handler: (url: string, init: RequestInit) => Response): StripeConfig => ({
  secretKey: "sk_test_x",
  siteUrl: "https://site.au",
  fetchImpl: vi.fn(async (url: string | URL | Request, init?: RequestInit) =>
    handler(String(url), init ?? {}),
  ) as typeof fetch,
});
const okCheckout = fakeStripe(() =>
  Response.json({
    id: "cs_test_1",
    url: "https://checkout.stripe.com/c/pay/cs_test_1",
    status: "open",
  }),
);

async function bookWithDeposit(stripe: StripeConfig | null = okCheckout) {
  const deps: PublicDeps = {
    db: t.db,
    config: { APP_ENV: "local", TURNSTILE_SECRET_KEY: undefined },
    notify: ctx,
    ip: null,
    suburbNames: ["Belmont"],
    now,
    stripe,
  };
  const r = await handleBookingRequest(
    {
      estimate: { service: "vacate", bedrooms: 2, bathrooms: 1 },
      bookerRole: "tenant",
      preferredDate: "2026-10-08",
      timeWindow: "am",
      address: "1 Example St",
      suburb: "Belmont",
      name: "Jane Citizen",
      phone: `04${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`,
      email: "jane@example.com",
      paymentChoice: "deposit",
      confirmCallUnderstood: true,
      turnstileToken: TURNSTILE_DUMMY_TOKEN,
    },
    deps,
  );
  if (r.status !== 200) throw new Error(JSON.stringify(r.body));
  const [b] = await t.db.select().from(bookings).where(eq(bookings.ref, r.body.ref));
  return { body: r.body, b };
}
const session = (
  b: { id: string; ref: string },
  over: Partial<CheckoutSession> = {},
): CheckoutSession => ({
  id: "cs_test_1",
  url: null,
  status: "complete",
  payment_status: "paid",
  payment_intent: "pi_1",
  amount_total: 5000,
  metadata: { bookingId: b.id, ref: b.ref },
  client_reference_id: b.id,
  ...over,
});
const event = (type: string, object: object) => ({
  id: `evt_${Math.random()}`,
  type,
  created: 0,
  data: { object: object as Record<string, unknown> },
});

describe("starting a deposit", () => {
  it("returns a Stripe Checkout URL and marks the deposit pending", async () => {
    const { body, b } = await bookWithDeposit();
    expect(body.checkoutUrl).toBe("https://checkout.stripe.com/c/pay/cs_test_1");
    expect(b).toMatchObject({
      depositStatus: "pending",
      depositCents: 5000,
      stripeSessionId: "cs_test_1",
      paymentChoice: "deposit",
    });
  });

  it("without Stripe (or if Stripe fails) the booking still goes through as pay-later, with a note", async () => {
    const { body, b } = await bookWithDeposit(null);
    expect(body.checkoutUrl).toBeUndefined();
    expect(b.depositStatus).toBe("none");
    const failing = fakeStripe(() =>
      Response.json({ error: { message: "Invalid API Key" } }, { status: 401 }),
    );
    const r2 = await bookWithDeposit(failing);
    expect(r2.body.checkoutUrl).toBeUndefined();
    const notes = (await t.db.select().from(messages)).filter((m) => m.channel === "note");
    expect(notes.map((n) => n.body).join(" ")).toMatch(
      /aren't set up.*Invalid API Key|Invalid API Key.*aren't set up/s,
    );
  });
});

describe("webhook events", () => {
  it("completed → paid once (alerts owners once); later 'expired' can't undo it", async () => {
    const { b } = await bookWithDeposit();
    await t.db.delete(messages);
    expect(await handleStripeEvent(ctx, event("checkout.session.completed", session(b)))).toBe(
      "paid",
    );
    expect(await handleStripeEvent(ctx, event("checkout.session.completed", session(b)))).toBe(
      "already recorded",
    );
    expect(
      await handleStripeEvent(
        ctx,
        event(
          "checkout.session.expired",
          session(b, { status: "expired", payment_status: "unpaid" }),
        ),
      ),
    ).toBe("ignored");
    const [after] = await t.db.select().from(bookings).where(eq(bookings.id, b.id));
    expect(after).toMatchObject({
      depositStatus: "paid",
      paidMethod: "stripe",
      stripePaymentIntentId: "pi_1",
    });
    const sms = (await t.db.select().from(messages)).filter(
      (m) => m.templateKey === "owner_deposit_paid_sms",
    );
    expect(sms).toHaveLength(1);
  });

  it("expired while pending → expired + owner alert; a late payment still wins", async () => {
    const { b } = await bookWithDeposit();
    expect(
      await handleStripeEvent(
        ctx,
        event(
          "checkout.session.expired",
          session(b, { status: "expired", payment_status: "unpaid" }),
        ),
      ),
    ).toBe("expired");
    expect(
      (await t.db.select().from(messages)).some(
        (m) => m.templateKey === "owner_deposit_expired_sms",
      ),
    ).toBe(true);
    expect(await handleStripeEvent(ctx, event("checkout.session.completed", session(b)))).toBe(
      "paid",
    );
  });

  it("charge.refunded records partial and full refunds from Stripe's totals", async () => {
    const { b } = await bookWithDeposit();
    await handleStripeEvent(ctx, event("checkout.session.completed", session(b)));
    expect(
      await handleStripeEvent(
        ctx,
        event("charge.refunded", { payment_intent: "pi_1", amount: 5000, amount_refunded: 2000 }),
      ),
    ).toBe("partially_refunded");
    expect(
      await handleStripeEvent(
        ctx,
        event("charge.refunded", { payment_intent: "pi_1", amount: 5000, amount_refunded: 2000 }),
      ),
    ).toBe("already recorded");
    expect(
      await handleStripeEvent(
        ctx,
        event("charge.refunded", { payment_intent: "pi_1", amount: 5000, amount_refunded: 5000 }),
      ),
    ).toBe("refunded");
    expect(await handleStripeEvent(ctx, event("payment_intent.created", {}))).toBe("ignored");
  });
});

describe("admin refunds", () => {
  it("validates the amount and records the refund", async () => {
    const { b } = await bookWithDeposit();
    await handleStripeEvent(ctx, event("checkout.session.completed", session(b)));
    const stripe = fakeStripe((url, init) => {
      expect(url).toBe("https://api.stripe.com/v1/refunds");
      expect(String(init.body)).toContain("payment_intent=pi_1");
      return Response.json({ id: "re_1", amount: 2000, status: "succeeded" });
    });
    expect(await refundDeposit(ctx, b.ref, 6000, "o@x.com", stripe)).toMatchObject({ ok: false });
    expect(await refundDeposit(ctx, b.ref, 2000, "o@x.com", stripe)).toMatchObject({ ok: true });
    const [after] = await t.db.select().from(bookings).where(eq(bookings.id, b.id));
    expect(after).toMatchObject({ refundedCents: 2000, depositStatus: "partially_refunded" });
    expect(await refundDeposit(ctx, b.ref, 3001, "o@x.com", stripe)).toMatchObject({ ok: false }); // only $30 left
  });
});

describe("safety net", () => {
  it("asks Stripe about stale pending deposits", async () => {
    const { b } = await bookWithDeposit();
    const later = new Date(now.getTime() + 3 * 3600_000);
    const stripe = fakeStripe(() => Response.json(session(b)));
    expect(await depositSafetyNet(ctx, stripe, later)).toBe("deposits: checked 1, fixed 1");
    const [after] = await t.db.select().from(bookings).where(eq(bookings.id, b.id));
    expect(after.depositStatus).toBe("paid");
    expect(await depositSafetyNet(ctx, null, later)).toMatch(/not configured/);
  });
});
