import type { Metadata } from "next";
import { EnquiryForm } from "@/components/site/enquiry-form";
import { Section } from "@/components/site/section";
import { getActiveServices, getSuburbs } from "@/lib/data/content";
import { pageMetadata } from "@/lib/data/site";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Request a quote",
    description:
      "Office, commercial or unusual property? Tell us what you need and we'll get back to you with a quote.",
    path: "/quote",
  });
}

const TYPES = ["contact", "quote", "property_manager"] as const;

export default async function QuotePage(props: PageProps<"/quote">) {
  const [services, sp] = await Promise.all([getActiveServices(), props.searchParams]);
  const type = TYPES.find((t) => t === sp.type) ?? "quote";
  const service = typeof sp.service === "string" ? sp.service : "";
  return (
    <Section className="max-w-2xl">
      <h1 className="text-ink text-3xl font-extrabold tracking-tight">
        {type === "property_manager" ? "Property managers" : "Request a quote"}
      </h1>
      <p className="text-muted mt-2 mb-8">
        Tell us what you need and we&apos;ll get back to you shortly.
      </p>
      <EnquiryForm
        defaultType={type}
        defaultService={services.some((s) => s.slug === service) ? service : ""}
        services={services.map((s) => ({ slug: s.slug, title: s.title }))}
        suburbs={getSuburbs().map((s) => s.name)}
      />
    </Section>
  );
}
