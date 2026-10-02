import Link from "next/link";
import type { Metadata } from "next";
import { EnquiryForm } from "@/components/site/enquiry-form";
import { Section } from "@/components/site/section";
import { getBusinessInfo } from "@/lib/data/business";
import { getActiveServices, getMediaByUsage, getSuburbs, mediaUrl } from "@/lib/data/content";
import { pageMetadata } from "@/lib/data/site";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Cleaning for property managers",
    description:
      "Vacate cleans to your inspection checklist. Book on behalf of tenants, or make us a preferred cleaner.",
    path: "/property-managers",
  });
}

export default async function PropertyManagersPage() {
  const [business, services, pack] = await Promise.all([
    getBusinessInfo(),
    getActiveServices(),
    getMediaByUsage("pm-pack"),
  ]);
  return (
    <>
      <Section tone="brand">
        <h1 className="text-ink text-3xl font-extrabold tracking-tight md:text-5xl">
          For property managers
        </h1>
        <p className="text-muted mt-4 max-w-2xl text-lg">
          Vacate cleans done to the checklist you use at the final inspection, with clear
          communication with your tenants.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/book"
            className="bg-accent hover:bg-accent-dark rounded-lg px-6 py-3 font-semibold text-white"
          >
            Book on behalf of a tenant
          </Link>
          <a
            href="#enquire"
            className="border-brand text-brand rounded-lg border-2 px-6 py-3 font-semibold"
          >
            Become a preferred cleaner
          </a>
        </div>
      </Section>
      <Section>
        <div className="grid gap-8 md:grid-cols-3">
          {[
            [
              "Your checklist",
              "Our vacate clean is built around the items property managers check at the final inspection.",
            ],
            [
              "We deal with the tenant",
              "Book on the tenant's behalf. We arrange access and timing with them directly, and keep you in the loop.",
            ],
            [
              "Re-clean guarantee",
              "If an item on our checklist was missed, we come back and fix it.",
            ],
          ].map(([t, d]) => (
            <div key={t}>
              <h2 className="text-ink text-lg font-semibold">{t}</h2>
              <p className="text-muted mt-2">{d}</p>
            </div>
          ))}
        </div>
        <p className="text-muted mt-6 text-sm">{business.insuranceText}.</p>
      </Section>
      {pack.length > 0 && (
        <Section tone="surface">
          <h2 className="text-ink text-2xl font-bold">Property manager pack</h2>
          <ul className="mt-4 space-y-2">
            {pack.map((m) => (
              <li key={m.id}>
                <a
                  href={mediaUrl(m)}
                  className="text-brand font-medium underline"
                  target="_blank"
                  rel="noopener"
                >
                  {m.alt} <span className="text-muted text-sm">(PDF)</span>
                </a>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section id="enquire" className="max-w-2xl">
        <h2 className="text-ink mb-6 text-2xl font-bold">Talk to us</h2>
        <EnquiryForm
          defaultType="property_manager"
          lockType
          services={services.map((s) => ({ slug: s.slug, title: s.title }))}
          suburbs={getSuburbs().map((s) => s.name)}
        />
      </Section>
    </>
  );
}
