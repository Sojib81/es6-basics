import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Markdown } from "@/components/ui/markdown";
import { Section } from "@/components/site/section";
import { getBusinessInfo } from "@/lib/data/business";
import { getPolicy } from "@/lib/data/content";
import { pageMetadata } from "@/lib/data/site";
import { renderTemplate } from "@/lib/notify/render";
import { formatAuPhone } from "@/lib/phone";

export async function generateMetadata(props: PageProps<"/policies/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const policy = await getPolicy(slug);
  return policy ? pageMetadata({ title: policy.title, path: `/policies/${slug}` }) : {};
}

export default async function PolicyPage(props: PageProps<"/policies/[slug]">) {
  const { slug } = await props.params;
  const [policy, business] = await Promise.all([getPolicy(slug), getBusinessInfo()]);
  if (!policy) notFound();
  const body = renderTemplate(policy.body, {
    businessName: business.businessName,
    abn: business.abn,
    phone: formatAuPhone(business.phone),
    email: business.publicEmail,
  });
  const updated = new Date(policy.updatedAt).toLocaleDateString("en-AU", {
    timeZone: "Australia/Perth",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return (
    <Section className="max-w-3xl">
      <h1 className="text-ink text-3xl font-extrabold tracking-tight">{policy.title}</h1>
      <p className="text-muted mt-2 mb-8 text-sm">Last updated {updated}</p>
      <Markdown source={body} />
    </Section>
  );
}
