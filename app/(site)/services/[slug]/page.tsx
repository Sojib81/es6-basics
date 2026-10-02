import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Markdown } from "@/components/ui/markdown";
import { JsonLd } from "@/components/site/json-ld";
import { PriceCalculator } from "@/components/site/price-calculator";
import { Reviews } from "@/components/site/reviews";
import { siteUrl } from "@/lib/config";
import { FaqList, Section } from "@/components/site/section";
import { getBusinessInfo } from "@/lib/data/business";
import { getFaqs, getPublishedReviews, getServiceBySlug, getSuburbs } from "@/lib/data/content";
import { getSetting } from "@/lib/data/settings";
import { getServiceOptions, pageMetadata } from "@/lib/data/site";
import { formatCents } from "@/lib/money";
import { priceFromCents } from "@/lib/price-from";
import { breadcrumbLd, faqLd, serviceLd } from "@/lib/seo/jsonld";

export async function generateMetadata(props: PageProps<"/services/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const service = await getServiceBySlug(slug);
  if (!service) return {};
  return pageMetadata({
    title: service.seoTitle ?? service.title,
    description: service.seoDescription ?? service.summary,
    path: `/services/${service.slug}`,
  });
}

export default async function ServicePage(props: PageProps<"/services/[slug]">) {
  const { slug } = await props.params;
  const service = await getServiceBySlug(slug);
  if (!service) notFound();

  const [business, pricing, faqs, options, reviews] = await Promise.all([
    getBusinessInfo(),
    getSetting("pricing"),
    getFaqs(service.slug),
    getServiceOptions(),
    getPublishedReviews(3),
  ]);
  const base = siteUrl();
  const from = priceFromCents(service.serviceKey, pricing, service.priceFromCents);
  const calculable = service.bookable && service.serviceKey && service.serviceKey !== "office";

  return (
    <>
      <JsonLd
        data={serviceLd({
          name: service.title,
          description: service.summary,
          url: `${base}/services/${service.slug}`,
          siteUrl: base,
          suburbs: getSuburbs(),
          priceFromCents: from,
        })}
      />
      <JsonLd data={faqLd(faqs)} />
      <JsonLd
        data={breadcrumbLd(base, [
          { name: "Home", path: "/" },
          { name: service.title, path: `/services/${service.slug}` },
        ])}
      />
      <Section tone="brand">
        <h1 className="text-ink text-3xl font-extrabold tracking-tight md:text-5xl">
          {service.title}
        </h1>
        <p className="text-muted mt-4 max-w-2xl text-lg">{service.summary}</p>
        {from !== null && (
          <p className="text-brand mt-4 text-xl font-bold">From {formatCents(from)}</p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          {calculable ? (
            <a
              href="#price"
              className="bg-accent hover:bg-accent-dark rounded-lg px-6 py-3 font-semibold text-white"
            >
              Get your price
            </a>
          ) : (
            <Link
              href={`/quote?type=quote&service=${service.slug}`}
              className="bg-accent hover:bg-accent-dark rounded-lg px-6 py-3 font-semibold text-white"
            >
              Request a quote
            </Link>
          )}
          <a
            href={`tel:${business.phone}`}
            className="border-brand text-brand rounded-lg border-2 px-6 py-3 font-semibold"
            data-track="click_call"
          >
            Call us
          </a>
        </div>
      </Section>

      <Section>
        <div className="grid gap-10 md:grid-cols-2">
          <Markdown source={service.body} />
          <div className="space-y-6">
            {service.checklist.length > 0 && (
              <div>
                <h2 className="text-ink text-xl font-bold">What&apos;s included</h2>
                <ul className="mt-3 space-y-2">
                  {service.checklist.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span aria-hidden className="text-brand">
                        ✓
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {service.notIncluded.length > 0 && (
              <div>
                <h2 className="text-ink text-xl font-bold">Not included</h2>
                <ul className="text-muted mt-3 space-y-1">
                  {service.notIncluded.map((item) => (
                    <li key={item}>– {item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </Section>

      {calculable && (
        <Section tone="surface" id="price">
          <h2 className="text-ink mb-6 text-2xl font-bold">Your instant price</h2>
          <PriceCalculator
            pricing={pricing}
            services={options}
            gstRegistered={business.gstRegistered}
            initial={{ service: service.serviceKey! }}
          />
        </Section>
      )}

      <Reviews reviews={reviews} />

      {faqs.length > 0 && (
        <Section>
          <h2 className="text-ink mb-6 text-2xl font-bold">Questions</h2>
          <FaqList items={faqs} />
        </Section>
      )}
    </>
  );
}
