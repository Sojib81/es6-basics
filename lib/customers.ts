/**
 * Customer matching for public submissions (BLUEPRINT.md 5.6, golden rule 8).
 * Match by E.164 phone. New phone → create. Existing phone → link only, NEVER overwrite.
 */
import { eq } from "drizzle-orm";
import type { Db } from "./db/client";
import { newId, nowIso } from "./db/ids";
import { CUSTOMER_TYPES, customers } from "./db/schema";

export type CustomerType = (typeof CUSTOMER_TYPES)[number];

export type SubmittedPerson = {
  phone: string; // E.164 — normalise with normalizeAuPhone() first
  name: string;
  email?: string | null;
  type?: CustomerType;
  agency?: string | null;
};

export type MatchResult = {
  customerId: string;
  created: boolean;
  /** True when the customer existed and the submitted name/email differ from the record. */
  detailsDiffer: boolean;
};

const norm = (s: string | null | undefined) => (s ?? "").trim().replace(/\s+/g, " ").toLowerCase();

export function detailsDiffer(
  existing: { name: string; email: string | null },
  submitted: { name: string; email?: string | null },
): boolean {
  if (norm(existing.name) !== norm(submitted.name)) return true;
  // A missing email on either side isn't a conflict.
  if (submitted.email && existing.email && norm(existing.email) !== norm(submitted.email))
    return true;
  return false;
}

export async function matchOrCreateCustomer(db: Db, person: SubmittedPerson): Promise<MatchResult> {
  if (!/^\+61\d{9}$/.test(person.phone)) throw new Error("Phone must be normalised E.164 (+61…)");

  const id = newId();
  const now = nowIso();
  // ON CONFLICT DO NOTHING makes concurrent submissions with the same phone safe.
  const inserted = await db
    .insert(customers)
    .values({
      id,
      name: person.name.trim(),
      phone: person.phone,
      email: person.email?.trim().toLowerCase() || null,
      type: person.type ?? "individual",
      agency: person.agency?.trim() || null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: customers.phone })
    .returning({ id: customers.id });

  if (inserted.length) return { customerId: inserted[0].id, created: true, detailsDiffer: false };

  const [existing] = await db.select().from(customers).where(eq(customers.phone, person.phone));
  return {
    customerId: existing.id,
    created: false,
    detailsDiffer: detailsDiffer(existing, person),
  };
}
