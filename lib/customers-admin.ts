/** Customer list/profile for the admin (BLUEPRINT 10.4). Edits are owner actions, audited. */
import { desc, eq, like, or, sql } from "drizzle-orm";
import { z } from "zod";
import { auditInsert } from "./audit";
import type { Db } from "./db/client";
import { nowIso } from "./db/ids";
import { bookings, CUSTOMER_TYPES, customers, enquiries, invoices } from "./db/schema";

export async function listCustomers(db: Db, opts: { q?: string; type?: string } = {}) {
  const q = opts.q?.trim();
  const digits = q?.replace(/\D/g, "") ?? "";
  const where = [
    ...(q
      ? [
          or(
            like(customers.name, `%${q}%`),
            like(customers.email, `%${q}%`),
            like(customers.agency, `%${q}%`),
            ...(digits.length >= 4 ? [like(customers.phone, `%${digits.replace(/^0/, "")}%`)] : []),
          )!,
        ]
      : []),
    ...(opts.type && (CUSTOMER_TYPES as readonly string[]).includes(opts.type)
      ? [eq(customers.type, opts.type as (typeof CUSTOMER_TYPES)[number])]
      : []),
  ];
  return db
    .select({
      c: customers,
      bookingCount: sql<number>`(select count(*) from bookings bc where bc.booker_customer_id = "customers"."id")`,
      lastBooking: sql<
        string | null
      >`(select max(bl.created_at) from bookings bl where bl.booker_customer_id = "customers"."id")`,
    })
    .from(customers)
    .where(where.length ? sql.join(where, sql` and `) : undefined)
    .orderBy(desc(customers.updatedAt))
    .limit(200);
}

export async function getCustomerProfile(db: Db, id: string) {
  const [c] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  if (!c) return null;
  const [bs, es, is] = await Promise.all([
    db
      .select()
      .from(bookings)
      .where(or(eq(bookings.bookerCustomerId, id), eq(bookings.pmCustomerId, id)))
      .orderBy(desc(bookings.createdAt)),
    db
      .select()
      .from(enquiries)
      .where(eq(enquiries.customerId, id))
      .orderBy(desc(enquiries.createdAt)),
    db.select().from(invoices).where(eq(invoices.customerId, id)).orderBy(desc(invoices.createdAt)),
  ]);
  return { customer: c, bookings: bs, enquiries: es, invoices: is };
}

export const customerEditSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(100),
  email: z
    .string()
    .trim()
    .max(200)
    .transform((v) => v.toLowerCase() || null)
    .pipe(z.email("Enter a valid email").nullable()),
  type: z.enum(CUSTOMER_TYPES),
  agency: z
    .string()
    .trim()
    .max(100)
    .transform((v) => v || null),
  notes: z
    .string()
    .max(4000)
    .transform((v) => v.trim() || null),
  smsOptOut: z.boolean(),
});

export async function updateCustomer(db: Db, id: string, raw: unknown, actorEmail: string) {
  const parsed = customerEditSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, message: parsed.error.issues[0].message };
  const [c] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  if (!c) return { ok: false as const, message: "Customer not found" };
  const v = parsed.data;
  const ts = nowIso();
  await db.batch([
    db
      .update(customers)
      .set({
        ...v,
        smsOptOutAt: v.smsOptOut === c.smsOptOut ? c.smsOptOutAt : v.smsOptOut ? ts : null,
        updatedAt: ts,
      })
      .where(eq(customers.id, id)),
    auditInsert(db, {
      actorEmail,
      action: "update",
      entity: "customer",
      entityId: id,
      before: {
        name: c.name,
        email: c.email,
        type: c.type,
        agency: c.agency,
        smsOptOut: c.smsOptOut,
      },
      after: v,
    }),
  ]);
  return { ok: true as const, message: "Saved." };
}
