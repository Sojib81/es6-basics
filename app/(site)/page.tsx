import Link from "next/link";
import type { Metadata } from "next";
import { getBusinessInfo } from "@/lib/data/business";

// PHASE 1 PLACEHOLDER home. The real lean home page (hero, trust strip, services, how it works)
// is task 3.11 and reads its text from the `home` settings key.
export async function generateMetadata(): Promise<Metadata> {
  const business = await getBusinessInfo();
  return { title: `${business.businessName} | ${business.tagline}`, description: business.tagline };
}

export default async function HomePage() {
  const business = await getBusinessInfo();

  return (
    <section className="bg-brand-light">
      <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <h1 className="text-ink max-w-2xl text-3xl font-extrabold tracking-tight md:text-5xl">
          {business.tagline}
        </h1>
        <p className="text-muted mt-4 max-w-xl text-lg">{business.responsePromise}.</p>
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
      </div>
    </section>
  );
}
