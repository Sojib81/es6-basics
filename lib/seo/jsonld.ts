/**
 * Structured data (BLUEPRINT 12). Service-area business: no street address, areaServed from suburbs.
 */
import type { BusinessSettings } from "@/lib/schemas/settings";

type Json = Record<string, unknown>;

export function localBusinessLd(opts: {
  business: BusinessSettings;
  siteUrl: string;
  suburbs: { name: string }[];
  logoUrl?: string | null;
}): Json {
  const { business, siteUrl } = opts;
  const sameAs = Object.values(business.socials).filter(Boolean);
  const days: Record<string, string> = {
    mon: "Monday",
    tue: "Tuesday",
    wed: "Wednesday",
    thu: "Thursday",
    fri: "Friday",
    sat: "Saturday",
    sun: "Sunday",
  };
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${siteUrl}/#business`,
    name: business.businessName,
    url: siteUrl,
    telephone: business.phone,
    email: business.publicEmail,
    ...(opts.logoUrl ? { logo: opts.logoUrl, image: opts.logoUrl } : {}),
    areaServed: opts.suburbs.map((s) => ({ "@type": "Place", name: `${s.name} WA` })),
    openingHoursSpecification: Object.entries(business.businessHours).flatMap(([d, h]) =>
      h
        ? [
            {
              "@type": "OpeningHoursSpecification",
              dayOfWeek: days[d],
              opens: h.open,
              closes: h.close,
            },
          ]
        : [],
    ),
    ...(sameAs.length ? { sameAs } : {}),
  };
}

export function serviceLd(opts: {
  name: string;
  description: string;
  url: string;
  siteUrl: string;
  suburbs: { name: string }[];
  priceFromCents: number | null;
}): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: opts.name,
    description: opts.description,
    url: opts.url,
    provider: { "@id": `${opts.siteUrl}/#business` },
    areaServed: opts.suburbs.map((s) => ({ "@type": "Place", name: `${s.name} WA` })),
    ...(opts.priceFromCents !== null
      ? {
          offers: {
            "@type": "Offer",
            priceCurrency: "AUD",
            priceSpecification: {
              "@type": "PriceSpecification",
              minPrice: (opts.priceFromCents / 100).toFixed(2),
              priceCurrency: "AUD",
            },
          },
        }
      : {}),
  };
}

export function faqLd(items: { question: string; answer: string }[]): Json | null {
  if (!items.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

export function breadcrumbLd(siteUrl: string, crumbs: { name: string; path: string }[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: `${siteUrl}${c.path}`,
    })),
  };
}

/** Safe for a <script> tag: escapes "<" so content can never close the script element. */
export function serializeLd(data: Json): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
