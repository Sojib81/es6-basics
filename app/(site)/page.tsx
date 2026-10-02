import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd } from "@/components/site/json-ld";
import { Reviews } from "@/components/site/reviews";
import { FaqList, Section } from "@/components/site/section";
import { siteUrl } from "@/lib/config";
import { getBusinessInfo } from "@/lib/data/business";
import { getActiveServices, getFaqs, getPublishedReviews, getSuburbs } from "@/lib/data/content";
import { getSetting } from "@/lib/data/settings";
import { pageMetadata } from "@/lib/data/site";
import { formatCents } from "@/lib/money";
import { priceFromCents } from "@/lib/price-from";
import { faqLd, localBusinessLd } from "@/lib/seo/jsonld";

export async function generateMetadata(): Promise<Metadata> {
  const business = await getBusinessInfo();
  return pageMetadata({ title: business.tagline, path: "/" });
}

export default async function HomePage() {
  const [business, home, pricing, services, faqs, reviews] = await Promise.all([
    getBusinessInfo(),
    getSetting("home"),
    getSetting("pricing"),
    getActiveServices(),
    getFaqs(null),
    getPublishedReviews(),
  ]);

  return (
    <>
      <JsonLd data={localBusinessLd({ business, siteUrl: siteUrl(), suburbs: getSuburbs() })} />
      <JsonLd data={faqLd(faqs)} />
      <Section tone="brand" className="md:py-24">
        <h1 className="text-ink max-w-3xl text-3xl font-extrabold tracking-tight md:text-5xl">
          {home.heroHeadline}
        </h1>
        <p className="text-muted mt-4 max-w-2xl text-lg">{home.heroSubheadline}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/pricing"
            className="bg-accent hover:bg-accent-dark rounded-lg px-6 py-3 font-semibold text-white"
          >
            Get an instant price
          </Link>
          <a
            href={`tel:${business.phone}`}
            className="border-brand text-brand rounded-lg border-2 px-6 py-3 font-semibold"
            data-track="click_call"
          >
            Call us
          </a>
        </div>
        <p className="text-muted mt-4 text-sm">{business.responsePromise}.</p>
        {home.trustPoints.length > 0 && (
          <ul className="text-ink mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium">
            {home.trustPoints.map((t) => (
              <li key={t} className="flex items-center gap-2">
                <span aria-hidden className="text-brand">
                  ✓
                </span>
                {t}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section>
        <h2 className="text-ink text-2xl font-bold md:text-3xl">Our services</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => {
            const from = priceFromCents(s.serviceKey, pricing, s.priceFromCents);
            return (
              <li key={s.id}>
                <Link
                  href={`/services/${s.slug}`}
                  className="border-line hover:border-brand block h-full rounded-xl border p-5 transition hover:shadow-sm"
                >
                  <h3 className="text-ink text-lg font-semibold">{s.title}</h3>
                  <p className="text-muted mt-2 text-sm">{s.summary}</p>
                  <p className="text-brand mt-3 font-semibold">
                    {from !== null ? `From ${formatCents(from)}` : "Free quote"}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      </Section>

      {home.howItWorks.length > 0 && (
        <Section tone="surface">
          <h2 className="text-ink text-2xl font-bold md:text-3xl">How it works</h2>
          <ol className="mt-6 grid gap-6 md:grid-cols-3">
            {home.howItWorks.map((step, i) => (
              <li key={step.title} className="rounded-xl bg-white p-5">
                <span className="bg-brand flex h-9 w-9 items-center justify-center rounded-full font-bold text-white">
                  {i + 1}
                </span>
                <h3 className="text-ink mt-3 font-semibold">{step.title}</h3>
                <p className="text-muted mt-1 text-sm">{step.text}</p>
              </li>
            ))}
          </ol>
        </Section>
      )}

      <Reviews reviews={reviews} />

      <Section>
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="text-ink text-2xl font-bold">Property managers</h2>
            <p className="text-muted mt-3">
              Book a vacate clean on behalf of your tenant, or ask about becoming a preferred
              cleaner for your agency.
            </p>
            <Link
              href="/quote?type=property_manager"
              className="text-brand mt-4 inline-block font-semibold underline"
            >
              Talk to us
            </Link>
          </div>
          <div>
            <h2 className="text-ink text-2xl font-bold">Areas we cover</h2>
            <p className="text-muted mt-3">{business.serviceAreaText}.</p>
            <Link href="/areas" className="text-brand mt-4 inline-block font-semibold underline">
              See all areas
            </Link>
          </div>
        </div>
      </Section>

      {faqs.length > 0 && (
        <Section tone="surface">
          <h2 className="text-ink mb-6 text-2xl font-bold">Questions</h2>
          <FaqList items={faqs} />
        </Section>
      )}

      <Section tone="brand" className="text-center">
        <h2 className="text-ink text-2xl font-bold md:text-3xl">
          See your price in under a minute
        </h2>
        <Link
          href="/pricing"
          className="bg-accent hover:bg-accent-dark mt-6 inline-block rounded-lg px-8 py-3 font-semibold text-white"
        >
          Get an instant price
        </Link>
      </Section>
    </>
  );
}
