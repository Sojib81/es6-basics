import type { Metadata } from "next";
import { JsonLd } from "@/components/site/json-ld";
import { FaqList, Section } from "@/components/site/section";
import { getActiveServices, getFaqs } from "@/lib/data/content";
import { pageMetadata } from "@/lib/data/site";
import { faqLd } from "@/lib/seo/jsonld";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({ title: "Frequently asked questions", path: "/faq" });
}

export default async function FaqPage() {
  const [general, services] = await Promise.all([getFaqs(null), getActiveServices()]);
  const perService = await Promise.all(
    services.map(async (s) => ({
      service: s,
      faqs: (await getFaqs(s.slug)).filter((f) => f.serviceSlug === s.slug),
    })),
  );
  const all = [...general, ...perService.flatMap((p) => p.faqs)];
  return (
    <Section className="max-w-3xl">
      <JsonLd data={faqLd(all)} />
      <h1 className="text-ink text-3xl font-extrabold tracking-tight">
        Frequently asked questions
      </h1>
      <div className="mt-8 space-y-10">
        <FaqList items={general} />
        {perService
          .filter((p) => p.faqs.length)
          .map((p) => (
            <div key={p.service.id}>
              <h2 className="text-ink mb-4 text-xl font-bold">{p.service.title}</h2>
              <FaqList items={p.faqs} />
            </div>
          ))}
      </div>
    </Section>
  );
}
