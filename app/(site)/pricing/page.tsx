import type { Metadata } from "next";
import { PriceCalculator } from "@/components/site/price-calculator";
import { Section } from "@/components/site/section";
import { getBusinessInfo } from "@/lib/data/business";
import { getSetting } from "@/lib/data/settings";
import { getServiceOptions, pageMetadata } from "@/lib/data/site";
import { decodeEstimate } from "@/lib/estimate-params";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Instant cleaning prices",
    description:
      "See your bond, vacate, regular or carpet cleaning price instantly. No obligation.",
    path: "/pricing",
  });
}

export default async function PricingPage(props: PageProps<"/pricing">) {
  const [business, pricing, options, sp] = await Promise.all([
    getBusinessInfo(),
    getSetting("pricing"),
    getServiceOptions(),
    props.searchParams,
  ]);
  return (
    <Section>
      <h1 className="text-ink text-3xl font-extrabold tracking-tight md:text-4xl">
        Get your price
      </h1>
      <p className="text-muted mt-2 mb-8">Answer a few questions to see your price instantly.</p>
      <PriceCalculator
        pricing={pricing}
        services={options}
        gstRegistered={business.gstRegistered}
        initial={decodeEstimate(sp) ?? undefined}
      />
    </Section>
  );
}
