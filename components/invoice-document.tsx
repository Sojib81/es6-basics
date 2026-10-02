/** The invoice itself — used by the customer page (/invoice/[token]) and the admin preview. */
import type { InvoiceRow } from "@/lib/invoices";
import type { BusinessSettings, InvoicingSettings } from "@/lib/schemas/settings";
import { formatCents } from "@/lib/money";
import { formatAuPhone } from "@/lib/phone";

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]} ${y}`;
};

export function InvoiceDocument({
  invoice: inv,
  business,
  invoicing,
}: {
  invoice: InvoiceRow;
  business: BusinessSettings;
  invoicing: InvoicingSettings;
}) {
  const bank = business.bankDetails;
  return (
    <article className="text-ink mx-auto max-w-[210mm] bg-white p-8 text-sm print:p-0">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="text-brand text-xl font-bold">{business.businessName}</p>
          <p>ABN {business.abn}</p>
          <p>
            {formatAuPhone(business.phone)} · {business.publicEmail}
          </p>
        </div>
        <div className="text-right">
          <h1 className="text-2xl font-extrabold tracking-wide uppercase">
            {inv.gstRegistered ? "Tax invoice" : "Invoice"}
          </h1>
          <p className="font-mono text-base">{inv.number}</p>
          <p>Issued {fmtDate(inv.issuedAt)}</p>
          <p>Due {fmtDate(inv.dueAt)}</p>
          {inv.status === "paid" && (
            <p className="mt-1 inline-block rounded bg-green-100 px-2 py-0.5 font-bold text-green-900">
              PAID
            </p>
          )}
          {inv.status === "void" && (
            <p className="mt-1 inline-block rounded bg-red-100 px-2 py-0.5 font-bold text-red-900">
              VOID
            </p>
          )}
        </div>
      </header>

      <section className="mt-8">
        <p className="text-muted text-xs font-semibold tracking-wide uppercase">Bill to</p>
        <p className="font-semibold">{inv.billToName}</p>
        {inv.billToAddress && <p>{inv.billToAddress}</p>}
        {inv.billToEmail && <p>{inv.billToEmail}</p>}
      </section>

      <table className="mt-8 w-full">
        <thead>
          <tr className="border-ink border-b-2 text-left">
            <th className="py-2">Description</th>
            <th className="py-2 text-right">Amount{inv.gstRegistered ? " (incl. GST)" : ""}</th>
          </tr>
        </thead>
        <tbody>
          {inv.lineItems.map((l, i) => (
            <tr key={i} className="border-line border-b">
              <td className="py-2 pr-4">{l.label}</td>
              <td className="py-2 text-right tabular-nums">{formatCents(l.amountCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="mt-4 ml-auto w-full max-w-xs space-y-1">
        {inv.gstRegistered && (
          <>
            <div className="flex justify-between">
              <dt>Subtotal (excl. GST)</dt>
              <dd className="tabular-nums">{formatCents(inv.subtotalCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>GST</dt>
              <dd className="tabular-nums">{formatCents(inv.gstCents)}</dd>
            </div>
          </>
        )}
        <div className="flex justify-between font-semibold">
          <dt>Total</dt>
          <dd className="tabular-nums">{formatCents(inv.totalCents)}</dd>
        </div>
        {inv.depositAppliedCents > 0 && (
          <div className="flex justify-between">
            <dt>Less deposit paid</dt>
            <dd className="tabular-nums">−{formatCents(inv.depositAppliedCents)}</dd>
          </div>
        )}
        <div className="border-ink flex justify-between border-t-2 pt-1 text-base font-bold">
          <dt>{inv.status === "paid" ? "Amount paid" : "Amount due"}</dt>
          <dd className="tabular-nums">{formatCents(inv.amountDueCents)}</dd>
        </div>
      </dl>

      {inv.status !== "paid" && inv.status !== "void" && bank.accountNumber && (
        <section className="bg-surface print:border-line mt-8 rounded-lg p-4 print:border">
          <p className="font-semibold">Pay by bank transfer</p>
          <p>Account name: {bank.accountName}</p>
          <p>
            BSB: {bank.bsb} · Account: {bank.accountNumber}
          </p>
          <p>Reference: {inv.number}</p>
        </section>
      )}

      {!inv.gstRegistered && <p className="text-muted mt-6 text-xs">No GST has been charged.</p>}
      {invoicing.footerText && <p className="text-muted mt-6">{invoicing.footerText}</p>}
    </article>
  );
}
