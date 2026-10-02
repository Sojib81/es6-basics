import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Markdown } from "@/components/ui/markdown";
import { JsonLd } from "@/components/site/json-ld";
import { PriceCalculator } from "@/components/site/price-calculator";
import { Section } from "@/components/site/section";
import { siteUrl } from "@/lib/config";
import { getBusinessInfo } from "@/lib/data/business";
import { getActiveServices, getSuburbs } from "@/lib/data/content";
import { getSetting } from "@/lib/data/settings";
import { getServiceOptions, pageMetadata } from "@/lib/data/site";
import { getSuburbBySlug } from "@/lib/data/suburbs";
import { formatCents } from "@/lib/money";
import { priceFromCents } from "@/lib/price-from";
import { breadcrumbLd } from "@/lib/seo/jsonld";
import { isIndexable, nearbySuburbs } from "@/lib/suburbs";

export async function generateMetadata(props: PageProps<"/areas/[suburb]">): Promise<Metadata> {
  const { suburb: slug } = await props.params;
  const suburb = getSuburbBySlug(slug);
  if (!suburb || !suburb.active) return {};
  return pageMetadata({
    title: `Vacate & Bond Cleaning ${suburb.name}`,
    description: `Agent-ready bond and vacate cleaning in ${suburb.name} ${suburb.postcode}. Instant price online; we call to confirm.`,
    path: `/areas/${suburb.slug}`,
    noindex: !isIndexable(suburb, getSuburbs()),
  });
}

export default async function SuburbPage(props: PageProps<"/areas/[suburb]">) {
  const { suburb: slug } = await props.params;
  const suburb = getSuburbBySlug(slug);
  if (!suburb || !suburb.active) notFound();

  const [business, pricing, services, options] = await Promise.all([
    getBusinessInfo(),
    getSetting("pricing"),
    getActiveServices(),
    getServiceOptions(),
  ]);
  const all = getSuburbs();
  const featured = services.filter((s) => suburb.featuredServices.includes(s.slug));
  const nearby = nearbySuburbs(suburb, all);

  return (
    <>
      <JsonLd
        data={breadcrumbLd(siteUrl(), [
          { name: "Home", path: "/" },
          { name: "Areas", path: "/areas" },
          { name: suburb.name, path: `/areas/${suburb.slug}` },
        ])}
      />
      <Section tone="brand">
        <h1 className="text-ink text-3xl font-extrabold tracking-tight md:text-5xl">
          Vacate &amp; Bond Cleaning in {suburb.name}
        </h1>
        <p className="text-muted mt-4 max-w-2xl text-lg">
          Instant online price, and we call to confirm. {business.responsePromise}.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="#price"
            className="bg-accent hover:bg-accent-dark rounded-lg px-6 py-3 font-semibold text-white"
          >
            Get your price
          </a>
          <a
            href={`tel:${business.phone}`}
            className="border-brand text-brand rounded-lg border-2 px-6 py-3 font-semibold"
            data-track="click_call"
          >
            Call us
          </a>
        </div>
      </Section>

      {suburb.intro && (
        <Section>
          <div className="max-w-3xl">
            <Markdown source={suburb.intro} />
          </div>
        </Section>
      )}

      {featured.length > 0 && (
        <Section tone="surface">
          <h2 className="text-ink text-2xl font-bold">Services in {suburb.name}</h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {featured.map((s) => {
              const from = priceFromCents(s.serviceKey, pricing, s.priceFromCents);
              return (
                <li key={s.id}>
                  <Link
                    href={`/services/${s.slug}`}
                    className="border-line hover:border-brand block h-full rounded-xl border bg-white p-5"
                  >
                    <h3 className="text-ink font-semibold">{s.title}</h3>
                    <p className="text-muted mt-1 text-sm">{s.summary}</p>
                    {from !== null && (
                      <p className="text-brand mt-2 font-semibold">From {formatCents(from)}</p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      <Section id="price">
        <h2 className="text-ink mb-6 text-2xl font-bold">Your instant price</h2>
        <PriceCalculator
          pricing={pricing}
          services={options}
          gstRegistered={business.gstRegistered}
          initial={{ service: "vacate" }}
        />
      </Section>

      {nearby.length > 0 && (
        <Section tone="surface">
          <h2 className="text-ink text-xl font-bold">We also clean nearby</h2>
          <ul className="mt-4 flex flex-wrap gap-3">
            {nearby.map((n) => (
              <li key={n.slug}>
                <Link
                  href={`/areas/${n.slug}`}
                  className="text-brand ring-line hover:ring-brand block rounded-full bg-white px-4 py-2 font-medium ring-1"
                >
                  {n.name}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}
