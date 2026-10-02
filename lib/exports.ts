/** CSV exports for the accountant (bookings and invoices by date range, Perth dates). */
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { centsToCsv, toCsv } from "./csv";
import { addDays } from "./booking-dates";
import type { Db } from "./db/client";
import { bookings, customers, invoices } from "./db/schema";
import { classifySource } from "./leads/source";
import { SERVICE_LABELS } from "./notify/alerts";
import { formatAuPhone } from "./phone";

const startOf = (date: string) => new Date(`${date}T00:00:00+08:00`).toISOString();

export async function bookingsCsv(db: Db, from: string, to: string): Promise<string> {
  const rows = await db
    .select({ b: bookings, phone: customers.phone, email: customers.email })
    .from(bookings)
    .innerJoin(customers, eq(customers.id, bookings.bookerCustomerId))
    .where(
      and(gte(bookings.createdAt, startOf(from)), lt(bookings.createdAt, startOf(addDays(to, 1)))),
    )
    .orderBy(asc(bookings.createdAt));
  return toCsv(
    [
      "Ref",
      "Created",
      "Status",
      "Service",
      "Bedrooms",
      "Bathrooms",
      "Suburb",
      "Name",
      "Phone",
      "Email",
      "Preferred date",
      "Scheduled date",
      "Estimate",
      "Final price",
      "Deposit status",
      "Deposit",
      "Refunded",
      "Paid by",
      "Source",
      "UTM source",
      "UTM campaign",
      "Lost reason",
    ],
    rows.map(({ b, phone, email }) => [
      b.ref,
      b.createdAt,
      b.status,
      SERVICE_LABELS[b.service],
      b.bedrooms,
      b.bathrooms,
      b.suburb,
      b.submittedName,
      formatAuPhone(phone),
      b.submittedEmail ?? email,
      b.preferredDate,
      b.scheduledDate,
      centsToCsv(b.estimateCents),
      centsToCsv(b.finalPriceCents),
      b.depositStatus,
      centsToCsv(b.depositCents),
      centsToCsv(b.refundedCents),
      b.paidMethod,
      classifySource(b),
      b.utmSource,
      b.utmCampaign,
      b.lostReason,
    ]),
  );
}

export async function invoicesCsv(db: Db, from: string, to: string): Promise<string> {
  const rows = await db
    .select()
    .from(invoices)
    .where(and(gte(invoices.issuedAt, from), lt(invoices.issuedAt, addDays(to, 1))))
    .orderBy(asc(invoices.issuedAt), asc(invoices.number));
  return toCsv(
    [
      "Number",
      "Issued",
      "Due",
      "Status",
      "Bill to",
      "Email",
      "Total (incl GST)",
      "GST",
      "Subtotal (excl GST)",
      "Deposit applied",
      "Amount due",
      "Paid at",
      "Paid by",
    ],
    rows.map((i) => [
      i.number,
      i.issuedAt,
      i.dueAt,
      i.status,
      i.billToName,
      i.billToEmail,
      centsToCsv(i.status === "void" ? 0 : i.totalCents),
      centsToCsv(i.status === "void" ? 0 : i.gstCents),
      centsToCsv(i.status === "void" ? 0 : i.subtotalCents),
      centsToCsv(i.depositAppliedCents),
      centsToCsv(i.amountDueCents),
      i.paidAt,
      i.paidMethod,
    ]),
  );
}
