import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd } from "@/components/site/json-ld";
import { Section } from "@/components/site/section";
import { getBusinessInfo } from "@/lib/data/business";
import { getSuburbs } from "@/lib/data/content";
import { pageMetadata } from "@/lib/data/site";
import { siteUrl } from "@/lib/config";
import { breadcrumbLd } from "@/lib/seo/jsonld";

export async function generateMetadata(): Promise<Metadata> {
  const business = await getBusinessInfo();
  return pageMetadata({
    title: "Areas we clean",
    description: `Bond, vacate and home cleaning across ${business.serviceAreaText}.`,
    path: "/areas",
  });
}

export default async function AreasPage() {
  const [business] = await Promise.all([getBusinessInfo()]);
  const suburbs = [...getSuburbs()].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <Section>
      <JsonLd
        data={breadcrumbLd(siteUrl(), [
          { name: "Home", path: "/" },
          { name: "Areas", path: "/areas" },
        ])}
      />
      <h1 className="text-ink text-3xl font-extrabold tracking-tight">Areas we clean</h1>
      <p className="text-muted mt-3 max-w-2xl">
        We clean homes across {business.serviceAreaText}. Not on the list? Get in touch — we may
        still be able to help.
      </p>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {suburbs.map((s) => (
          <li key={s.slug}>
            <Link
              href={`/areas/${s.slug}`}
              className="border-line hover:border-brand flex justify-between rounded-lg border p-4"
            >
              <span className="text-ink font-semibold">{s.name}</span>
              <span className="text-muted">{s.postcode}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}
