import type { Metadata } from "next";
import { Markdown } from "@/components/ui/markdown";
import { JsonLd } from "@/components/site/json-ld";
import { Section } from "@/components/site/section";
import { siteUrl } from "@/lib/config";
import { getBusinessInfo } from "@/lib/data/business";
import { getSuburbs } from "@/lib/data/content";
import { getSetting } from "@/lib/data/settings";
import { pageMetadata } from "@/lib/data/site";
import { localBusinessLd } from "@/lib/seo/jsonld";

export async function generateMetadata(): Promise<Metadata> {
  const about = await getSetting("about");
  return pageMetadata({ title: about.heading, path: "/about" });
}

export default async function AboutPage() {
  const [about, business] = await Promise.all([getSetting("about"), getBusinessInfo()]);
  return (
    <Section className="max-w-3xl">
      <JsonLd data={localBusinessLd({ business, siteUrl: siteUrl(), suburbs: getSuburbs() })} />
      <h1 className="text-ink text-3xl font-extrabold tracking-tight">{about.heading}</h1>
      <div className="mt-6">
        <Markdown source={about.body} />
      </div>
      <p className="text-muted mt-8 text-sm">
        {business.businessName} · ABN {business.abn} · {business.insuranceText}
      </p>
    </Section>
  );
}
