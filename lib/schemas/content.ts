/** Zod schemas for content seed files and admin content edits (BLUEPRINT 5.3). */
import { z } from "@/lib/zod";
import { POLICY_SLUGS, SERVICE_KEYS } from "@/lib/db/schema";

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "lower-case words joined by hyphens");

export const serviceSchema = z.object({
  id: z.string().min(1),
  slug,
  serviceKey: z.enum(SERVICE_KEYS).nullable(),
  title: z.string().min(1),
  summary: z.string().min(1),
  body: z.string(),
  checklist: z.array(z.string()),
  notIncluded: z.array(z.string()),
  priceFromCents: z.number().int().nonnegative().nullable(),
  bookable: z.boolean(),
  capacityWeight: z.number().int().min(1).max(4),
  sortOrder: z.number().int(),
  active: z.boolean(),
  seoTitle: z.string().max(60).nullable(),
  seoDescription: z.string().max(155).nullable(),
});

export const faqSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  answer: z.string().min(1),
  serviceSlug: slug.nullable(),
  sortOrder: z.number().int(),
  active: z.boolean(),
});

export const policySchema = z.object({
  slug: z.enum(POLICY_SLUGS),
  title: z.string().min(1),
  body: z.string().min(1),
});

export const suburbSchema = z.object({
  slug,
  name: z.string().min(1),
  postcode: z.string().regex(/^6\d{3}$/),
  intro: z.string(),
  nearby: z.array(slug),
  featuredServices: z.array(slug),
  active: z.boolean(),
});

export type ServiceContent = z.infer<typeof serviceSchema>;
export type FaqContent = z.infer<typeof faqSchema>;
export type PolicyContent = z.infer<typeof policySchema>;
export type Suburb = z.infer<typeof suburbSchema>;
