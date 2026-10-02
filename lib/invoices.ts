/**
 * Invoices (BLUEPRINT 10.5) — built in, no Xero/subscription.
 * Prices are GST-inclusive; when GST-registered, GST = total ÷ 11 (rounded to the cent).
 * Numbers are sequential from settings.invoicing.nextInvoiceNumber, claimed atomically in SQL.
 * A claimed number whose insert fails leaves a gap — acceptable (and visible in the audit log).
 */
import { and, desc, eq, gte, inArray, lt, ne, sql } from "drizzle-orm";
import { auditInsert, readSetting } from "./audit";
import { addDays } from "./booking-dates";
import type { Db } from "./db/client";
import { newId, nowIso } from "./db/ids";
import { bookings, customers, invoices, settings, type LineItem } from "./db/schema";
import { formatCents } from "./money";
import { formatIsoDate, SERVICE_LABELS } from "./notify/alerts";
import { sendTemplate, type NotifyContext } from "./notify/deliver";
import { formatAuPhone } from "./phone";
import { perthDateString } from "./time";

export type InvoiceRow = typeof invoices.$inferSelect;

/** GST included in a GST-inclusive amount: 1/11th, rounded half up. */
export function gstIncluded(totalCents: number): number {
  return Math.floor((totalCents + 5) / 11);
}

function token(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Atomically takes the next invoice number (single UPDATE … RETURNING). */
export async function claimInvoiceNumber(db: Db): Promise<string> {
  const [row] = await db
    .update(settings)
    .set({
      value: sql`json_set(${settings.value}, '$.nextInvoiceNumber', json_extract(${settings.value}, '$.nextInvoiceNumber') + 1)`,
    })
    .where(eq(settings.key, "invoicing"))
    .returning({
      number: sql<number>`json_extract(${settings.value}, '$.nextInvoiceNumber') - 1`,
      prefix: sql<string>`json_extract(${settings.value}, '$.invoicePrefix')`,
    });
  if (!row) throw new Error("Invoicing settings missing");
  return `${row.prefix ?? ""}${row.number}`;
}

type Result =
  { ok: true; invoice: InvoiceRow; existing?: boolean } | { ok: false; message: string };

export async function createInvoiceFromBooking(
  db: Db,
  ref: string,
  actorEmail: string,
  now: Date = new Date(),
): Promise<Result> {
  const [row] = await db
    .select({ b: bookings, c: customers })
    .from(bookings)
    .innerJoin(customers, eq(customers.id, bookings.bookerCustomerId))
    .where(eq(bookings.ref, ref))
    .limit(1);
  if (!row) return { ok: false, message: "Booking not found" };
  const { b, c } = row;

  const [open] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.bookingId, b.id), ne(invoices.status, "void")))
    .limit(1);
  if (open) return { ok: true, invoice: open, existing: true };

  const total = b.finalPriceCents ?? b.estimateCents;
  if (total === null || total <= 0) return { ok: false, message: "Set the final price first." };

  const [business, invoicing] = await Promise.all([
    readSetting(db, "business"),
    readSetting(db, "invoicing"),
  ]);
  const service = SERVICE_LABELS[b.service] ?? "Cleaning";
  const when = b.scheduledDate ?? b.preferredDate;
  const lineItems: LineItem[] =
    b.finalPriceCents === null || b.finalPriceCents === b.estimateCents
      ? b.lineItems
      : [
          {
            label: `${service}${b.suburb ? ` — ${b.suburb}` : ""}${when ? ` (${formatIsoDate(when)})` : ""}`,
            amountCents: b.finalPriceCents,
          },
        ];
  const gst = business.gstRegistered ? gstIncluded(total) : 0;
  const deposit =
    b.depositStatus === "paid" || b.depositStatus === "partially_refunded"
      ? (b.depositCents ?? 0) - b.refundedCents
      : 0;
  const billToPm = b.billTo === "property_manager" && b.pmName;
  const issued = perthDateString(now);

  const number = await claimInvoiceNumber(db);
  const invoice: InvoiceRow = {
    id: newId(),
    number,
    bookingId: b.id,
    customerId: c.id,
    billToName: billToPm ? `${b.pmName}${b.pmAgency ? `, ${b.pmAgency}` : ""}` : b.submittedName,
    billToEmail: b.submittedEmail ?? c.email,
    billToAddress: b.address ? `${b.address}${b.suburb ? `, ${b.suburb}` : ""} WA` : null,
    lineItems,
    subtotalCents: total - gst,
    gstCents: gst,
    totalCents: total,
    depositAppliedCents: Math.max(0, Math.min(deposit, total)),
    amountDueCents: Math.max(0, total - deposit),
    gstRegistered: business.gstRegistered,
    status: "draft",
    issuedAt: issued,
    dueAt: addDays(issued, invoicing.paymentTermsDays),
    paidAt: null,
    paidMethod: null,
    publicToken: token(),
    notes: null,
    createdAt: nowIso(now),
    updatedAt: nowIso(now),
  };
  if (invoice.amountDueCents === 0) {
    invoice.status = "paid";
    invoice.paidAt = nowIso(now);
    invoice.paidMethod = "stripe";
  }
  await db.batch([
    db.insert(invoices).values(invoice),
    auditInsert(db, {
      actorEmail,
      action: "create",
      entity: "invoice",
      entityId: invoice.id,
      after: { number, totalCents: total, bookingRef: ref },
    }),
  ]);
  return { ok: true, invoice };
}

async function load(db: Db, id: string) {
  const [inv] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  return inv ?? null;
}

export async function markInvoicePaid(
  db: Db,
  id: string,
  method: "cash" | "transfer" | "stripe",
  actorEmail: string,
  now: Date = new Date(),
): Promise<{ ok: boolean; message: string }> {
  const inv = await load(db, id);
  if (!inv) return { ok: false, message: "Invoice not found" };
  if (inv.status === "void") return { ok: false, message: "This invoice is void." };
  if (inv.status === "paid") return { ok: true, message: "Already paid." };
  const writes = [
    db
      .update(invoices)
      .set({ status: "paid", paidAt: nowIso(now), paidMethod: method, updatedAt: nowIso(now) })
      .where(eq(invoices.id, id)),
    auditInsert(db, {
      actorEmail,
      action: "status_change",
      entity: "invoice",
      entityId: id,
      before: { status: inv.status },
      after: { status: "paid", method },
    }),
  ] as const;
  if (inv.bookingId) {
    await db.batch([
      ...writes,
      db
        .update(bookings)
        .set({ paidMethod: method, updatedAt: nowIso(now) })
        .where(eq(bookings.id, inv.bookingId)),
    ]);
  } else await db.batch([...writes]);
  return { ok: true, message: "Marked paid." };
}

export async function setInvoiceStatus(
  db: Db,
  id: string,
  status: "sent" | "void",
  actorEmail: string,
): Promise<{ ok: boolean; message: string }> {
  const inv = await load(db, id);
  if (!inv) return { ok: false, message: "Invoice not found" };
  if (status === "void" && inv.status === "paid")
    return { ok: false, message: "Paid invoices can't be voided — refund first." };
  if (status === "sent" && inv.status !== "draft") return { ok: true, message: "OK" };
  await db.batch([
    db.update(invoices).set({ status, updatedAt: nowIso() }).where(eq(invoices.id, id)),
    auditInsert(db, {
      actorEmail,
      action: "status_change",
      entity: "invoice",
      entityId: id,
      before: { status: inv.status },
      after: { status },
    }),
  ]);
  return {
    ok: true,
    message: status === "void" ? "Invoice voided (kept for your records)." : "Marked sent.",
  };
}

export type InvoiceFilter = "all" | "unpaid" | "overdue" | "paid_this_month";

export async function listInvoices(db: Db, filter: InvoiceFilter = "all", now: Date = new Date()) {
  const today = perthDateString(now);
  const monthStart = `${today.slice(0, 8)}01`;
  const where =
    filter === "unpaid"
      ? inArray(invoices.status, ["draft", "sent"])
      : filter === "overdue"
        ? and(inArray(invoices.status, ["draft", "sent"]), lt(invoices.dueAt, today))
        : filter === "paid_this_month"
          ? and(
              eq(invoices.status, "paid"),
              gte(invoices.paidAt, new Date(`${monthStart}T00:00:00+08:00`).toISOString()),
            )
          : undefined;
  return db.select().from(invoices).where(where).orderBy(desc(invoices.createdAt)).limit(500);
}

export async function getInvoiceByToken(db: Db, publicToken: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(publicToken)) return null;
  const [inv] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.publicToken, publicToken))
    .limit(1);
  return inv ?? null;
}

/** Emails the invoice link to the customer (customer_invoice_email) and marks it sent. */
export async function sendInvoice(
  ctx: NotifyContext,
  id: string,
  actorEmail: string,
  siteUrl: string,
): Promise<{ ok: boolean; message: string }> {
  const inv = await load(ctx.db, id);
  if (!inv) return { ok: false, message: "Invoice not found" };
  if (inv.status === "void") return { ok: false, message: "This invoice is void." };
  if (!inv.billToEmail)
    return { ok: false, message: "No email address for this customer — add one on their profile." };
  const business = await readSetting(ctx.db, "business");
  const status = await sendTemplate(
    ctx,
    "customer_invoice_email",
    {
      firstName: inv.billToName.split(/[\s,]+/)[0],
      name: inv.billToName,
      invoiceNumber: inv.number,
      amountDue: formatCents(inv.amountDueCents),
      invoiceUrl: `${siteUrl}/invoice/${inv.publicToken}`,
      businessName: business.businessName,
      phone: formatAuPhone(business.phone),
    },
    { to: inv.billToEmail, bookingId: inv.bookingId, sentBy: actorEmail },
  );
  if (status === "failed")
    return { ok: false, message: "Sending failed — see the booking's message log." };
  if (status === "skipped")
    return { ok: false, message: "The invoice email template is turned off." };
  if (inv.status === "draft") await setInvoiceStatus(ctx.db, id, "sent", actorEmail);
  return {
    ok: true,
    message:
      status === "sandboxed"
        ? `Logged (test mode — not sent) to ${inv.billToEmail}.`
        : `Sent to ${inv.billToEmail}.`,
  };
}

export async function getInvoice(db: Db, id: string) {
  return load(db, id);
}
