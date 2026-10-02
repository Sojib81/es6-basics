/**
 * Admin edits to a booking (BLUEPRINT 10.2): scheduling, final price, payment, customer details,
 * and customer messages (confirmation, reminder, review request, free-text replies).
 * Every change is audited; every message is logged to the thread.
 */
import { and, eq } from "drizzle-orm";
import { auditInsert, readSetting } from "@/lib/audit";
import { capacityUnitsFor, getSlotLoads, wouldExceed } from "@/lib/capacity";
import type { Db } from "@/lib/db/client";
import { nowIso } from "@/lib/db/ids";
import { bookings, customers, enquiries, services } from "@/lib/db/schema";
import { bookingTemplateVars } from "@/lib/notify/alerts";
import {
  deliver,
  sendTemplate,
  type DeliveryStatus,
  type NotifyContext,
} from "@/lib/notify/deliver";
import { formatAuPhone } from "@/lib/phone";
import type { OpResult } from "./admin-ops";

async function load(db: Db, ref: string) {
  const [row] = await db
    .select({ b: bookings, c: customers })
    .from(bookings)
    .innerJoin(customers, eq(customers.id, bookings.bookerCustomerId))
    .where(eq(bookings.ref, ref))
    .limit(1);
  return row ?? null;
}

const NOT_FOUND: OpResult = { ok: false, code: "not_found", message: "Booking not found" };

export async function scheduleBooking(
  db: Db,
  ref: string,
  slot: { date: string; window: string },
  actorEmail: string,
  opts: { overrideCapacity?: boolean } = {},
): Promise<OpResult> {
  const row = await load(db, ref);
  if (!row) return NOT_FOUND;
  const { b } = row;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(slot.date))
    return { ok: false, code: "invalid", message: "Pick a date" };
  const settings = await readSetting(db, "booking");
  if (!settings.timeWindows.some((w) => w.id === slot.window))
    return { ok: false, code: "invalid", message: "Pick a time window" };

  const [svc] = await db.select().from(services).where(eq(services.serviceKey, b.service)).limit(1);
  const units = capacityUnitsFor(svc?.capacityWeight ?? 1, b.bedrooms, settings.largeJobBedrooms);
  if (b.status === "confirmed" && !opts.overrideCapacity) {
    const loads = await getSlotLoads(db, slot.date, slot.date);
    if (b.scheduledDate === slot.date && b.scheduledWindow === slot.window) {
      const k = `${slot.date}|${slot.window}`;
      loads.set(k, (loads.get(k) ?? 0) - (b.capacityUnits ?? 0));
    }
    if (wouldExceed(loads, slot.date, slot.window, units, settings.maxJobsPerWindow))
      return { ok: false, code: "capacity", message: "That slot is full. Schedule anyway?" };
  }

  await db.batch([
    db
      .update(bookings)
      .set({
        scheduledDate: slot.date,
        scheduledWindow: slot.window,
        capacityUnits: units,
        updatedAt: nowIso(),
      })
      .where(eq(bookings.id, b.id)),
    auditInsert(db, {
      actorEmail,
      action: "update",
      entity: "booking",
      entityId: b.id,
      before: { scheduledDate: b.scheduledDate, scheduledWindow: b.scheduledWindow },
      after: {
        scheduledDate: slot.date,
        scheduledWindow: slot.window,
        ...(opts.overrideCapacity ? { overrideCapacity: true } : {}),
      },
    }),
  ]);
  return { ok: true };
}

export async function setFinalPrice(
  db: Db,
  ref: string,
  cents: number | null,
  actorEmail: string,
): Promise<OpResult> {
  const row = await load(db, ref);
  if (!row) return NOT_FOUND;
  if (cents !== null && (!Number.isInteger(cents) || cents < 0 || cents > 10_000_000))
    return { ok: false, code: "invalid", message: "Enter a valid price" };
  await db.batch([
    db
      .update(bookings)
      .set({ finalPriceCents: cents, updatedAt: nowIso() })
      .where(eq(bookings.id, row.b.id)),
    auditInsert(db, {
      actorEmail,
      action: "update",
      entity: "booking",
      entityId: row.b.id,
      before: { finalPriceCents: row.b.finalPriceCents },
      after: { finalPriceCents: cents },
    }),
  ]);
  return { ok: true };
}

export async function setPaidMethod(
  db: Db,
  ref: string,
  method: "cash" | "transfer" | "unpaid",
  actorEmail: string,
): Promise<OpResult> {
  const row = await load(db, ref);
  if (!row) return NOT_FOUND;
  if (row.b.paidMethod === "stripe" && method !== "unpaid")
    return { ok: false, code: "invalid", message: "This booking was paid by card." };
  await db.batch([
    db
      .update(bookings)
      .set({ paidMethod: method, updatedAt: nowIso() })
      .where(eq(bookings.id, row.b.id)),
    auditInsert(db, {
      actorEmail,
      action: "update",
      entity: "booking",
      entityId: row.b.id,
      before: { paidMethod: row.b.paidMethod },
      after: { paidMethod: method },
    }),
  ]);
  return { ok: true };
}

/** "Details differ" → owner chose to update the customer record with what was submitted. */
export async function updateCustomerFromBooking(
  db: Db,
  ref: string,
  actorEmail: string,
): Promise<OpResult> {
  const row = await load(db, ref);
  if (!row) return NOT_FOUND;
  const { b, c } = row;
  const next = { name: b.submittedName, email: b.submittedEmail ?? c.email };
  await db.batch([
    db
      .update(customers)
      .set({ ...next, updatedAt: nowIso() })
      .where(eq(customers.id, c.id)),
    db
      .update(bookings)
      .set({ customerDetailsDiffer: false })
      .where(and(eq(bookings.bookerCustomerId, c.id), eq(bookings.submittedName, b.submittedName))),
    auditInsert(db, {
      actorEmail,
      action: "update",
      entity: "customer",
      entityId: c.id,
      before: { name: c.name, email: c.email },
      after: next,
    }),
  ]);
  return { ok: true };
}

// ---------------------------------------------------------------- customer messages

export type QuickMessage = "confirmation" | "reminder" | "review";

export async function sendBookingMessage(
  ctx: NotifyContext,
  ref: string,
  kind: QuickMessage,
  actorEmail: string,
): Promise<{ ok: boolean; message: string; statuses?: DeliveryStatus[] }> {
  const row = await load(ctx.db, ref);
  if (!row) return { ok: false, message: "Booking not found" };
  const { b, c } = row;
  const [business, bookingSettings] = await Promise.all([
    readSetting(ctx.db, "business"),
    readSetting(ctx.db, "booking"),
  ]);
  const vars = bookingTemplateVars(b, c.phone, business, bookingSettings);
  const link = { bookingId: b.id, sentBy: actorEmail };
  const email = b.submittedEmail ?? c.email;

  let statuses: DeliveryStatus[] = [];
  if (kind === "confirmation" || kind === "reminder") {
    if (!b.scheduledDate || !b.scheduledWindow)
      return { ok: false, message: "Schedule a date and time first." };
    if (kind === "confirmation") {
      statuses = await Promise.all([
        ...(email
          ? [sendTemplate(ctx, "customer_booking_confirmed_email", vars, { ...link, to: email })]
          : []),
        sendTemplate(ctx, "customer_booking_confirmed_sms", vars, { ...link, to: c.phone }),
      ]);
    } else {
      statuses = [
        await sendTemplate(ctx, "customer_job_reminder_sms", vars, { ...link, to: c.phone }),
      ];
    }
  } else {
    if (b.status !== "completed") return { ok: false, message: "Mark the job completed first." };
    if (!business.googleReviewUrl)
      return { ok: false, message: "Add your Google review link in Settings → Business info." };
    if (c.smsOptOut)
      return { ok: false, message: "This customer has opted out of marketing texts." };
    statuses = [
      await sendTemplate(ctx, "customer_review_request_sms", vars, { ...link, to: c.phone }),
    ];
  }

  const ok = statuses.some((s) => s === "sent" || s === "sandboxed");
  const label = { confirmation: "Confirmation", reminder: "Reminder", review: "Review request" }[
    kind
  ];
  return {
    ok,
    statuses,
    message: ok
      ? `${label} ${statuses.includes("sandboxed") ? "logged (test mode — not sent)" : "sent"}.`
      : statuses.every((s) => s === "skipped")
        ? `${label} template is turned off.`
        : `${label} failed to send — see the message log.`,
  };
}

/** Free-text reply to the customer by email or SMS from a booking or enquiry. */
export async function sendReply(
  ctx: NotifyContext,
  target: { bookingRef?: string; enquiryRef?: string },
  channel: "email" | "sms",
  subject: string,
  body: string,
  actorEmail: string,
): Promise<{ ok: boolean; message: string }> {
  const text = body.trim();
  if (!text) return { ok: false, message: "Write a message first." };
  if (text.length > 5000) return { ok: false, message: "That message is too long." };

  let to: string | null = null;
  let link: { bookingId?: string; enquiryId?: string } = {};
  let enquiryId: string | null = null;
  if (target.bookingRef) {
    const row = await load(ctx.db, target.bookingRef);
    if (!row) return { ok: false, message: "Booking not found" };
    to = channel === "email" ? (row.b.submittedEmail ?? row.c.email) : row.c.phone;
    link = { bookingId: row.b.id };
  } else if (target.enquiryRef) {
    const [q] = await ctx.db
      .select()
      .from(enquiries)
      .where(eq(enquiries.ref, target.enquiryRef))
      .limit(1);
    if (!q) return { ok: false, message: "Enquiry not found" };
    to = channel === "email" ? q.email : q.phone;
    link = { enquiryId: q.id };
    enquiryId = q.id;
  }
  if (!to)
    return {
      ok: false,
      message: channel === "email" ? "No email address for this customer." : "No phone number.",
    };

  const status = await deliver(ctx, {
    channel,
    to,
    subject: channel === "email" ? subject.trim() || "Re: your enquiry" : null,
    body: text,
    sentBy: actorEmail,
    ...link,
  });
  if (enquiryId && (status === "sent" || status === "sandboxed"))
    await ctx.db
      .update(enquiries)
      .set({ status: "replied", updatedAt: nowIso() })
      .where(eq(enquiries.id, enquiryId));
  const shown = channel === "email" ? to : formatAuPhone(to);
  return status === "sent"
    ? { ok: true, message: `Sent to ${shown}.` }
    : status === "sandboxed"
      ? { ok: true, message: `Logged (test mode — not sent) to ${shown}.` }
      : { ok: false, message: "Sending failed — see the message log." };
}
