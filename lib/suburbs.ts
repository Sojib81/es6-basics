/**
 * Suburb page rules (BLUEPRINT 12 — avoid doorway pages): a suburb is indexed only when its intro is
 * at least 150 words and not shared with any other suburb. Everything else is noindex and left out
 * of the sitemap (the page still exists for visitors and internal links).
 */
import type { Suburb } from "./schemas/content";

export const MIN_INDEXABLE_WORDS = 150;

export const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

const normalise = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();

export function isIndexable(suburb: Suburb, all: Suburb[]): boolean {
  if (!suburb.active || wordCount(suburb.intro) < MIN_INDEXABLE_WORDS) return false;
  const mine = normalise(suburb.intro);
  return !all.some((o) => o.slug !== suburb.slug && normalise(o.intro) === mine);
}

/** Up to `limit` nearby active suburbs, in the order listed in the seed. */
export function nearbySuburbs(suburb: Suburb, all: Suburb[], limit = 3): Suburb[] {
  return suburb.nearby
    .map((slug) => all.find((s) => s.slug === slug && s.active))
    .filter((s): s is Suburb => !!s)
    .slice(0, limit);
}
