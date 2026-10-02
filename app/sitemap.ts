import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/config";
import { getActiveServices } from "@/lib/data/content";
import { getIndexableSuburbs } from "@/lib/data/suburbs";
import { POLICY_SLUGS } from "@/lib/db/schema";

/** Built per request from active services and indexable suburbs only (BLUEPRINT 12). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const services = await getActiveServices();
  const fixed = [
    "",
    "/pricing",
    "/areas",
    "/property-managers",
    "/about",
    "/faq",
    "/contact",
    "/quote",
  ];
  return [
    ...fixed.map((p) => ({
      url: `${base}${p || "/"}`,
      changeFrequency: "weekly" as const,
      priority: p === "" ? 1 : 0.7,
    })),
    ...services.map((s) => ({
      url: `${base}/services/${s.slug}`,
      lastModified: s.updatedAt,
      priority: 0.9,
    })),
    ...getIndexableSuburbs().map((s) => ({ url: `${base}/areas/${s.slug}`, priority: 0.8 })),
    ...POLICY_SLUGS.map((p) => ({ url: `${base}/policies/${p}`, priority: 0.2 })),
  ];
}
