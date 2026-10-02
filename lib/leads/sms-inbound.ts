/**
 * Incoming texts from the SMS provider's webhook (BLUEPRINT 11 "SMS opt-out").
 * STOP-type replies opt the number out of marketing texts (Spam Act); START opts back in.
 * Every reply is logged to the customer's latest booking or enquiry so owners see it.
 */
import { desc, eq } from "drizzle-orm";
import { auditInsert } from "@/lib/audit";
import type { Db } from "@/lib/db/client";
import { newId, nowIso } from "@/lib/db/ids";
import { bookings, customers, enquiries, messages } from "@/lib/db/schema";
import { normalizeAuPhone } from "@/lib/phone";

const STOP = /^\s*(stop|stop all|unsubscribe|cancel|end|quit|opt ?out)\s*[.!]?\s*$/i;
const START = /^\s*(start|unstop|subscribe|opt ?in)\s*[.!]?\s*$/i;

/** Pulls sender + text from ClickSend (JSON/form) or Twilio (form) payloads. */
export function parseInboundSms(
  fields: Record<string, unknown>,
): { from: string; body: string } | null {
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = fields[k];
      if (typeof v === "string" && v.trim()) return v;
    }
    return null;
  };
  const from = pick("from", "From", "sender", "msisdn");
  const body = pick("body", "Body", "message", "text", "original_body");
  return from && body !== null ? { from, body: body.slice(0, 2000) } : null;
}

export async function handleInboundSms(
  db: Db,
  sms: { from: string; body: string },
  now: Date = new Date(),
): Promise<{ action: "opted_out" | "opted_in" | "logged" | "ignored" }> {
  const phone = normalizeAuPhone(sms.from);
  if (!phone) return { action: "ignored" };
  const ts = nowIso(now);

  let [customer] = await db.select().from(customers).where(eq(customers.phone, phone)).limit(1);
  const wantsOut = STOP.test(sms.body);
  const wantsIn = START.test(sms.body);
  if (!customer && wantsOut) {
    // Remember the opt-out even before they ever book.
    [customer] = await db
      .insert(customers)
      .values({
        id: newId(),
        name: "Unknown (texted STOP)",
        phone,
        smsOptOut: true,
        smsOptOutAt: ts,
        createdAt: ts,
        updatedAt: ts,
      })
      .returning();
    return { action: "opted_out" };
  }
  if (!customer) return { action: "ignored" };

  const [lastBooking] = await db
    .select({ id: bookings.id, createdAt: bookings.createdAt })
    .from(bookings)
    .where(eq(bookings.bookerCustomerId, customer.id))
    .orderBy(desc(bookings.createdAt))
    .limit(1);
  const [lastEnquiry] = await db
    .select({ id: enquiries.id, createdAt: enquiries.createdAt })
    .from(enquiries)
    .where(eq(enquiries.customerId, customer.id))
    .orderBy(desc(enquiries.createdAt))
    .limit(1);
  const useBooking =
    lastBooking && (!lastEnquiry || lastBooking.createdAt >= lastEnquiry.createdAt);

  const log = db.insert(messages).values({
    id: newId(),
    bookingId: useBooking ? lastBooking.id : null,
    enquiryId: !useBooking && lastEnquiry ? lastEnquiry.id : null,
    direction: "in",
    channel: "sms",
    recipient: null,
    body: sms.body,
    sentBy: phone,
    status: "sent",
    createdAt: ts,
  });

  const optOut = wantsOut && !customer.smsOptOut;
  const optIn = wantsIn && customer.smsOptOut;
  if (!optOut && !optIn) {
    await log;
    return { action: "logged" };
  }
  await db.batch([
    log,
    db
      .update(customers)
      .set({ smsOptOut: optOut, smsOptOutAt: optOut ? ts : null, updatedAt: ts })
      .where(eq(customers.id, customer.id)),
    auditInsert(db, {
      actorEmail: "sms",
      action: "update",
      entity: "customer",
      entityId: customer.id,
      before: { smsOptOut: customer.smsOptOut },
      after: { smsOptOut: optOut },
    }),
  ]);
  const action = optOut ? "opted_out" : "opted_in";
  return { action };
}
