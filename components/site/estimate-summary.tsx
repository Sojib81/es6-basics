"use client";
import Link from "next/link";
import { formatCents } from "@/lib/money";
import { QUOTE_ONLY_MESSAGE, type Estimate } from "@/lib/pricing";

export function EstimateSummary({
  estimate,
  gstRegistered,
}: {
  estimate: Estimate;
  gstRegistered: boolean;
}) {
  if (estimate.quoteOnly) {
    return (
      <div className="border-line bg-surface rounded-xl border p-5" aria-live="polite">
        <p className="text-ink font-semibold">{QUOTE_ONLY_MESSAGE[estimate.reason]}</p>
        <Link href="/quote" className="text-brand mt-3 inline-block font-semibold underline">
          Request a quote
        </Link>
      </div>
    );
  }
  return (
    <div className="border-brand bg-brand-light rounded-xl border p-5" aria-live="polite">
      <p className="text-brand text-sm font-semibold tracking-wide uppercase">Estimated price</p>
      <p className="text-ink text-4xl font-extrabold" data-testid="estimate-total">
        {formatCents(estimate.totalCents)}
        {gstRegistered && <span className="text-muted ml-2 text-base font-medium">incl. GST</span>}
      </p>
      {estimate.estimatedHalfHours && (
        <p className="text-muted text-sm">About {estimate.estimatedHalfHours / 2} hours</p>
      )}
      <details className="mt-3 text-sm">
        <summary className="text-brand cursor-pointer font-medium">
          See what&apos;s included in this price
        </summary>
        <ul className="mt-2 space-y-1">
          {estimate.lineItems.map((i, n) => (
            <li key={n} className="flex justify-between gap-4">
              <span>{i.label}</span>
              <span className="tabular-nums">{formatCents(i.amountCents)}</span>
            </li>
          ))}
        </ul>
      </details>
      <p className="text-muted mt-3 text-sm">
        Final price confirmed on our call. If anything changes, we tell you before we start.
      </p>
    </div>
  );
}
