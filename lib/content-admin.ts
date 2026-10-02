/**
 * Content editing for owners (BLUEPRINT 10.7): services, FAQs, policies, reviews.
 * Every change stores the FULL before/after row in the audit log, so History can restore it.
 * Slugs are read-only in the admin (changing them would break links and SEO).
 */
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { auditInsert, saveSettingWithHistory } from "./audit";
import type { Db } from "./db/client";
import { newId, nowIso } from "./db/ids";
import { auditLog, faqs, policies, reviews, services } from "./db/schema";
import { SETTING_KEYS, type SettingKey } from "./schemas/settings";
import { perthDateString } from "./time";

type Result = { ok: true; id?: string } | { ok: false; message: string };
const fail = (e: z.ZodError): Result => ({
  ok: false,
  message: e.issues[0]?.message ?? "Check the form",
});

const lines = z
  .string()
  .max(4000)
  .transform((v) =>
    v
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean),
  );

// ---------------------------------------------------------------- services

export const serviceEditSchema = z.object({
  title: z.string().trim().min(1, "Enter a title").max(80),
  summary: z.string().trim().min(1, "Enter a summary").max(300),
  body: z.string().max(10_000),
  checklist: lines,
  notIncluded: lines,
  priceFromCents: z.number().int().nonnegative().nullable(),
  bookable: z.boolean(),
  capacityWeight: z.number().int().min(1).max(4),
  sortOrder: z.number().int().min(0).max(999),
  active: z.boolean(),
  seoTitle: z
    .string()
    .trim()
    .max(60, "SEO title: 60 characters max")
    .transform((v) => v || null),
  seoDescription: z
    .string()
    .trim()
    .max(155, "SEO description: 155 characters max")
    .transform((v) => v || null),
  heroMediaId: z.string().nullable().default(null),
});

export async function updateService(
  db: Db,
  id: string,
  raw: unknown,
  actorEmail: string,
): Promise<Result> {
  const parsed = serviceEditSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error);
  const [before] = await db.select().from(services).where(eq(services.id, id)).limit(1);
  if (!before) return { ok: false, message: "Service not found" };
  const after = { ...before, ...parsed.data, updatedAt: nowIso() };
  await db.batch([
    db.update(services).set(after).where(eq(services.id, id)),
    auditInsert(db, {
      actorEmail,
      action: "update",
      entity: "service",
      entityId: id,
      before,
      after,
    }),
  ]);
  return { ok: true };
}

// ---------------------------------------------------------------- FAQs

export const faqEditSchema = z.object({
  question: z.string().trim().min(3, "Enter the question").max(300),
  answer: z.string().trim().min(1, "Enter the answer").max(3000),
  serviceSlug: z
    .string()
    .trim()
    .transform((v) => v || null),
  active: z.boolean(),
});

export async function saveFaq(
  db: Db,
  id: string | null,
  raw: unknown,
  actorEmail: string,
): Promise<Result> {
  const parsed = faqEditSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error);
  if (id) {
    const [before] = await db.select().from(faqs).where(eq(faqs.id, id)).limit(1);
    if (!before) return { ok: false, message: "FAQ not found" };
    const after = { ...before, ...parsed.data };
    await db.batch([
      db.update(faqs).set(after).where(eq(faqs.id, id)),
      auditInsert(db, { actorEmail, action: "update", entity: "faq", entityId: id, before, after }),
    ]);
    return { ok: true, id };
  }
  const all = await db.select({ sortOrder: faqs.sortOrder }).from(faqs);
  const row = {
    id: newId(),
    ...parsed.data,
    sortOrder: Math.max(0, ...all.map((f) => f.sortOrder)) + 1,
  };
  await db.batch([
    db.insert(faqs).values(row),
    auditInsert(db, { actorEmail, action: "create", entity: "faq", entityId: row.id, after: row }),
  ]);
  return { ok: true, id: row.id };
}

export async function deleteFaq(db: Db, id: string, actorEmail: string): Promise<Result> {
  const [before] = await db.select().from(faqs).where(eq(faqs.id, id)).limit(1);
  if (!before) return { ok: false, message: "FAQ not found" };
  await db.batch([
    db.delete(faqs).where(eq(faqs.id, id)),
    auditInsert(db, { actorEmail, action: "delete", entity: "faq", entityId: id, before }),
  ]);
  return { ok: true };
}

/** Swaps sort order with the neighbour in the same group (general or same service). */
export async function moveFaq(
  db: Db,
  id: string,
  dir: -1 | 1,
  actorEmail: string,
): Promise<Result> {
  const all = await db.select().from(faqs).orderBy(asc(faqs.sortOrder), asc(faqs.question));
  const me = all.find((f) => f.id === id);
  if (!me) return { ok: false, message: "FAQ not found" };
  const group = all.filter((f) => f.serviceSlug === me.serviceSlug);
  const i = group.indexOf(me);
  const other = group[i + dir];
  if (!other) return { ok: true };
  // Normalise then swap, so equal sortOrders can't get stuck.
  const a = i * 10;
  const b = (i + dir) * 10;
  await db.batch([
    ...group.map((f, n) =>
      db
        .update(faqs)
        .set({ sortOrder: n * 10 })
        .where(eq(faqs.id, f.id)),
    ),
    db.update(faqs).set({ sortOrder: b }).where(eq(faqs.id, me.id)),
    db.update(faqs).set({ sortOrder: a }).where(eq(faqs.id, other.id)),
    auditInsert(db, {
      actorEmail,
      action: "update",
      entity: "faq",
      entityId: id,
      before: { sortOrder: me.sortOrder },
      after: { moved: dir },
    }),
  ] as unknown as Parameters<typeof db.batch>[0]);
  return { ok: true };
}

// ---------------------------------------------------------------- policies

export const policyEditSchema = z.object({
  title: z.string().trim().min(1).max(80),
  body: z.string().trim().min(20, "The policy looks too short").max(30_000),
});

export async function updatePolicy(
  db: Db,
  slug: string,
  raw: unknown,
  actorEmail: string,
): Promise<Result> {
  const parsed = policyEditSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error);
  const [before] = await db
    .select()
    .from(policies)
    .where(eq(policies.slug, slug as never))
    .limit(1);
  if (!before) return { ok: false, message: "Policy not found" };
  const after = { ...before, ...parsed.data, updatedAt: nowIso() };
  await db.batch([
    db.update(policies).set(after).where(eq(policies.slug, before.slug)),
    auditInsert(db, {
      actorEmail,
      action: "update",
      entity: "policy",
      entityId: before.slug,
      before,
      after,
    }),
  ]);
  return { ok: true };
}

// ---------------------------------------------------------------- reviews (real ones only)

export const reviewEditSchema = z.object({
  name: z.string().trim().min(1, "Enter the reviewer's name").max(60),
  suburb: z
    .string()
    .trim()
    .max(60)
    .transform((v) => v || null),
  text: z.string().trim().min(5, "Paste the review text").max(1500),
  rating: z.number().int().min(1).max(5),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the review date"),
  source: z.string().trim().min(1, "Where was it posted? e.g. Google").max(40),
  published: z.boolean(),
});

export async function saveReview(
  db: Db,
  id: string | null,
  raw: unknown,
  actorEmail: string,
  now = new Date(),
): Promise<Result> {
  const parsed = reviewEditSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error);
  if (parsed.data.date > perthDateString(now))
    return { ok: false, message: "The review date can't be in the future." };
  if (id) {
    const [before] = await db.select().from(reviews).where(eq(reviews.id, id)).limit(1);
    if (!before) return { ok: false, message: "Review not found" };
    const after = { ...before, ...parsed.data };
    await db.batch([
      db.update(reviews).set(after).where(eq(reviews.id, id)),
      auditInsert(db, {
        actorEmail,
        action: "update",
        entity: "review",
        entityId: id,
        before,
        after,
      }),
    ]);
    return { ok: true, id };
  }
  const row = { id: newId(), ...parsed.data, createdAt: nowIso(now) };
  await db.batch([
    db.insert(reviews).values(row),
    auditInsert(db, {
      actorEmail,
      action: "create",
      entity: "review",
      entityId: row.id,
      after: row,
    }),
  ]);
  return { ok: true, id: row.id };
}

export async function deleteReview(db: Db, id: string, actorEmail: string): Promise<Result> {
  const [before] = await db.select().from(reviews).where(eq(reviews.id, id)).limit(1);
  if (!before) return { ok: false, message: "Review not found" };
  await db.batch([
    db.delete(reviews).where(eq(reviews.id, id)),
    auditInsert(db, { actorEmail, action: "delete", entity: "review", entityId: id, before }),
  ]);
  return { ok: true };
}

// ---------------------------------------------------------------- restore from history

const RESTORABLE = ["settings", "service", "faq", "policy", "review"] as const;

export function isRestorable(entry: { entity: string; action: string; before: unknown }): boolean {
  return (
    (RESTORABLE as readonly string[]).includes(entry.entity) &&
    entry.before !== null &&
    entry.action !== "create"
  );
}

/** Puts an item back the way it was BEFORE the given change. The restore is itself audited. */
export async function restoreFromAudit(
  db: Db,
  auditId: string,
  actorEmail: string,
): Promise<Result> {
  const [entry] = await db.select().from(auditLog).where(eq(auditLog.id, auditId)).limit(1);
  if (!entry || !isRestorable(entry))
    return { ok: false, message: "This change can't be restored." };
  const before = entry.before as Record<string, unknown>;
  switch (entry.entity) {
    case "settings": {
      if (!SETTING_KEYS.includes(entry.entityId as SettingKey))
        return { ok: false, message: "Unknown setting" };
      await saveSettingWithHistory(db, entry.entityId as SettingKey, before, actorEmail, "restore");
      return { ok: true };
    }
    case "service": {
      const [current] = await db
        .select()
        .from(services)
        .where(eq(services.id, entry.entityId))
        .limit(1);
      if (!current) return { ok: false, message: "That service no longer exists." };
      const restored = { ...(before as typeof current), updatedAt: nowIso() };
      await db.batch([
        db.update(services).set(restored).where(eq(services.id, entry.entityId)),
        auditInsert(db, {
          actorEmail,
          action: "restore",
          entity: "service",
          entityId: entry.entityId,
          before: current,
          after: restored,
        }),
      ]);
      return { ok: true };
    }
    case "faq": {
      const [current] = await db.select().from(faqs).where(eq(faqs.id, entry.entityId)).limit(1);
      const row = before as typeof faqs.$inferInsert;
      await db.batch([
        current
          ? db.update(faqs).set(row).where(eq(faqs.id, entry.entityId))
          : db.insert(faqs).values(row),
        auditInsert(db, {
          actorEmail,
          action: "restore",
          entity: "faq",
          entityId: entry.entityId,
          before: current ?? null,
          after: row,
        }),
      ]);
      return { ok: true };
    }
    case "policy": {
      const row = { ...(before as typeof policies.$inferInsert), updatedAt: nowIso() };
      const [current] = await db
        .select()
        .from(policies)
        .where(eq(policies.slug, entry.entityId as never))
        .limit(1);
      await db.batch([
        db
          .update(policies)
          .set(row)
          .where(eq(policies.slug, entry.entityId as never)),
        auditInsert(db, {
          actorEmail,
          action: "restore",
          entity: "policy",
          entityId: entry.entityId,
          before: current ?? null,
          after: row,
        }),
      ]);
      return { ok: true };
    }
    case "review": {
      const [current] = await db
        .select()
        .from(reviews)
        .where(eq(reviews.id, entry.entityId))
        .limit(1);
      const row = before as typeof reviews.$inferInsert;
      await db.batch([
        current
          ? db.update(reviews).set(row).where(eq(reviews.id, entry.entityId))
          : db.insert(reviews).values(row),
        auditInsert(db, {
          actorEmail,
          action: "restore",
          entity: "review",
          entityId: entry.entityId,
          before: current ?? null,
          after: row,
        }),
      ]);
      return { ok: true };
    }
  }
  return { ok: false, message: "This change can't be restored." };
}
