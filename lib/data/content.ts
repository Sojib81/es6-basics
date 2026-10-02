/** Content loaders (per request, React cache()). Suburbs are seed-only (BLUEPRINT 5.3). */
import { cache } from "react";
import { and, asc, desc, eq, isNull, or } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  faqs,
  media,
  MEDIA_USAGES,
  policies,
  reviews,
  services,
  type ServiceKey,
} from "@/lib/db/schema";
import { suburbSchema, type Suburb } from "@/lib/schemas/content";
import suburbsSeed from "@/seed/suburbs.json";

export type ServiceRow = typeof services.$inferSelect;
export type FaqRow = typeof faqs.$inferSelect;
export type PolicyRow = typeof policies.$inferSelect;

export const getActiveServices = cache(async (): Promise<ServiceRow[]> => {
  const db = await getDb();
  return db
    .select()
    .from(services)
    .where(eq(services.active, true))
    .orderBy(asc(services.sortOrder));
});

export const getServiceBySlug = cache(async (slug: string): Promise<ServiceRow | null> => {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(services)
    .where(and(eq(services.slug, slug), eq(services.active, true)))
    .limit(1);
  return row ?? null;
});

export const getServiceByKey = cache(async (key: ServiceKey): Promise<ServiceRow | null> => {
  const db = await getDb();
  const [row] = await db.select().from(services).where(eq(services.serviceKey, key)).limit(1);
  return row ?? null;
});

/** General FAQs, plus the service's own FAQs when a slug is given. */
export const getFaqs = cache(async (serviceSlug: string | null = null): Promise<FaqRow[]> => {
  const db = await getDb();
  const where = serviceSlug
    ? and(eq(faqs.active, true), or(isNull(faqs.serviceSlug), eq(faqs.serviceSlug, serviceSlug)))
    : and(eq(faqs.active, true), isNull(faqs.serviceSlug));
  const rows = await db.select().from(faqs).where(where).orderBy(asc(faqs.sortOrder));
  // Service-specific questions first
  return rows.sort((a, b) => Number(!a.serviceSlug) - Number(!b.serviceSlug));
});

export const getPolicy = cache(async (slug: string): Promise<PolicyRow | null> => {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(policies)
    .where(eq(policies.slug, slug as PolicyRow["slug"]))
    .limit(1);
  return row ?? null;
});

const allSuburbs: Suburb[] = suburbSchema.array().parse(suburbsSeed);

export function getSuburbs(): Suburb[] {
  return allSuburbs.filter((s) => s.active);
}

export type ReviewRow = typeof reviews.$inferSelect;
export type MediaRow = typeof media.$inferSelect;

/** Only real, published reviews (golden rule 10). Empty → the reviews section doesn't render. */
export const getPublishedReviews = cache(async (limit = 6): Promise<ReviewRow[]> => {
  const db = await getDb();
  return db
    .select()
    .from(reviews)
    .where(eq(reviews.published, true))
    .orderBy(desc(reviews.date))
    .limit(limit);
});

export const getMediaByUsage = cache(
  async (usage: (typeof MEDIA_USAGES)[number]): Promise<MediaRow[]> => {
    const db = await getDb();
    return db.select().from(media).where(eq(media.usage, usage)).orderBy(desc(media.createdAt));
  },
);

export const getMediaById = cache(async (id: string | null): Promise<MediaRow | null> => {
  if (!id) return null;
  const db = await getDb();
  const [row] = await db.select().from(media).where(eq(media.id, id)).limit(1);
  return row ?? null;
});

export const mediaUrl = (m: Pick<MediaRow, "r2Key">) => `/media/${m.r2Key}`;
