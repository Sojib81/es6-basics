import { isIndexable } from "@/lib/suburbs";
import { getSuburbs } from "./content";

export function getSuburbBySlug(slug: string) {
  return getSuburbs().find((s) => s.slug === slug) ?? null;
}

export function getIndexableSuburbs() {
  const all = getSuburbs();
  return all.filter((s) => isIndexable(s, all));
}
