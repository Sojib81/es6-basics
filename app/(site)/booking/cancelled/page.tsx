import type { Metadata } from "next";
import { LeadConversion } from "@/components/site/lead-conversion";
import { RetryDeposit } from "@/components/site/retry-deposit";
import { Section } from "@/components/site/section";
import { getBusinessInfo } from "@/lib/data/business";
import { pageMetadata } from "@/lib/data/site";
import { formatAuPhone } from "@/lib/phone";
import { isRef } from "@/lib/refs";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({ title: "Booking received", path: "/booking/cancelled", noindex: true });
}

export default async function DepositCancelled(props: PageProps<"/booking/cancelled">) {
  const [business, sp] = await Promise.all([getBusinessInfo(), props.searchParams]);
  const ref = typeof sp.ref === "string" && isRef(sp.ref, "BK") ? sp.ref : null;
  return (
    <Section className="max-w-2xl text-center">
      {ref && <LeadConversion refCode={ref} />}
      <h1 className="text-ink text-3xl font-extrabold tracking-tight">
        We&apos;ve got your booking request
      </h1>
      {ref && (
        <p className="mt-3 text-lg">
          Your reference: <strong className="font-mono">{ref}</strong>
        </p>
      )}
      <p className="text-muted mt-4">
        The deposit wasn&apos;t paid — that&apos;s fine. {business.responsePromise}, and you can pay
        after we confirm.
      </p>
      {ref && <RetryDeposit refCode={ref} />}
      <p className="mt-6">
        <a
          href={`tel:${business.phone}`}
          className="text-brand font-semibold"
          data-track="click_call"
        >
          Call {formatAuPhone(business.phone)}
        </a>
      </p>
    </Section>
  );
}
