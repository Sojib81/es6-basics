import Link from "next/link";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { DepositConversion } from "@/components/site/deposit-conversion";
import { LeadConversion } from "@/components/site/lead-conversion";
import { Section } from "@/components/site/section";
import { getServerEnv, stripeConfigFrom } from "@/lib/config";
import { getBusinessInfo } from "@/lib/data/business";
import { pageMetadata } from "@/lib/data/site";
import { createDb } from "@/lib/db/client";
import { bookings } from "@/lib/db/schema";
import { applySessionCompleted } from "@/lib/leads/deposits";
import { formatCents } from "@/lib/money";
import { notifyContextFrom } from "@/lib/notify/context";
import { formatAuPhone } from "@/lib/phone";
import { isRef } from "@/lib/refs";
import { retrieveCheckoutSession } from "@/lib/stripe";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({ title: "Deposit received", path: "/booking/success", noindex: true });
}

export default async function DepositSuccess(props: PageProps<"/booking/success">) {
  const sp = await props.searchParams;
  const ref = typeof sp.ref === "string" && isRef(sp.ref, "BK") ? sp.ref : null;
  const sessionId =
    typeof sp.session_id === "string" && /^cs_[A-Za-z0-9_]{10,200}$/.test(sp.session_id)
      ? sp.session_id
      : null;
  const [business, { env, config }] = await Promise.all([getBusinessInfo(), getServerEnv()]);
  const db = createDb(env.DB);

  // Don't wait for the webhook: confirm with Stripe directly (idempotent with the webhook).
  const stripe = stripeConfigFrom(config);
  if (ref && sessionId && stripe) {
    try {
      const s = await retrieveCheckoutSession(stripe.secretKey, sessionId);
      if (s.metadata?.ref === ref) await applySessionCompleted(notifyContextFrom(db, config), s);
    } catch (e) {
      console.error("success page: Stripe check failed", e);
    }
  }
  const [b] = ref ? await db.select().from(bookings).where(eq(bookings.ref, ref)).limit(1) : [];
  const paid = b?.depositStatus === "paid";

  return (
    <Section className="max-w-2xl text-center">
      {ref && <LeadConversion refCode={ref} />}
      {ref && paid && b.depositCents && (
        <DepositConversion refCode={ref} valueCents={b.depositCents} />
      )}
      <p className="text-5xl" aria-hidden>
        ✓
      </p>
      <h1 className="text-ink mt-4 text-3xl font-extrabold tracking-tight">
        {paid ? "Deposit received — thank you!" : "Thanks — we're confirming your payment"}
      </h1>
      {ref && (
        <p className="mt-3 text-lg">
          Your reference:{" "}
          <strong className="font-mono" data-testid="lead-ref">
            {ref}
          </strong>
          {paid && b.depositCents ? ` · ${formatCents(b.depositCents)} paid` : ""}
        </p>
      )}
      <p className="text-muted mt-4">
        {business.responsePromise}. Your booking is confirmed once we&apos;ve spoken on the phone.
      </p>
      <p className="mt-6">
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
