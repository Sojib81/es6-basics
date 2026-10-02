import type { Metadata } from "next";
import type { ServiceOption } from "@/components/site/property-fields";
import { getActiveServices, getMediaById, mediaUrl } from "./content";
import { getSetting } from "./settings";

/** Bookable/priceable services in display order, for the calculator and wizard. */
export async function getServiceOptions(): Promise<ServiceOption[]> {
  const services = await getActiveServices();
  return services.flatMap((s) => (s.serviceKey ? [{ key: s.serviceKey, title: s.title }] : []));
}

/** Page metadata with the SEO title suffix from settings (BLUEPRINT 12). */
export async function pageMetadata(opts: {
  title: string;
  description?: string | null;
  path: string;
  noindex?: boolean;
}): Promise<Metadata> {
  const seo = await getSetting("seo");
  const description = opts.description || seo.defaultDescription;
  const og = await getMediaById(seo.ogImageMediaId);
  const image = og ? mediaUrl(og) : "/og-default.png";
  return {
    title: `${opts.title}${seo.titleSuffix}`,
    description,
    alternates: { canonical: opts.path },
    openGraph: {
      title: opts.title,
      description,
      url: opts.path,
      type: "website",
      locale: "en_AU",
      images: [{ url: image, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title: opts.title, description, images: [image] },
    ...(opts.noindex ? { robots: { index: false, follow: true } } : {}),
  };
}
