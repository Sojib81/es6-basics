import Link from "next/link";
import type { Metadata } from "next";
import { LeadConversion } from "@/components/site/lead-conversion";
import { Section } from "@/components/site/section";
import { getBusinessInfo } from "@/lib/data/business";
import { pageMetadata } from "@/lib/data/site";
import { formatAuPhone } from "@/lib/phone";
import { isRef } from "@/lib/refs";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({ title: "Thank you", path: "/thank-you", noindex: true });
}

export default async function ThankYouPage(props: PageProps<"/thank-you">) {
  const [business, sp] = await Promise.all([getBusinessInfo(), props.searchParams]);
  const ref = typeof sp.ref === "string" && isRef(sp.ref) ? sp.ref : null;
  const isBooking = ref?.startsWith("BK-");

  return (
    <Section className="max-w-2xl text-center">
      {ref && <LeadConversion refCode={ref} />}
      <p className="text-5xl" aria-hidden>
        ✓
      </p>
      <h1 className="text-ink mt-4 text-3xl font-extrabold tracking-tight">
        {isBooking ? "Booking request received" : "Message received"}
      </h1>
      {ref && (
        <p className="mt-3 text-lg">
          Your reference:{" "}
          <strong className="font-mono" data-testid="lead-ref">
            {ref}
          </strong>
        </p>
      )}
      <p className="text-muted mt-4">
        {business.responsePromise}.
        {isBooking ? " Your booking isn't confirmed until we've spoken." : ""}
      </p>
      <p className="mt-6">
        Can&apos;t wait?{" "}
        <a
          href={`tel:${business.phone}`}
          className="text-brand font-semibold"
          data-track="click_call"
        >
          Call {formatAuPhone(business.phone)}
        </a>
      </p>
      <Link href="/" className="text-brand mt-8 inline-block underline">
        Back to home
      </Link>
    </Section>
  );
}
