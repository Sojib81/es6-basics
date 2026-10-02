import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { InvoiceDocument } from "@/components/invoice-document";
import { PrintButton } from "@/components/print-button";
import { getSetting } from "@/lib/data/settings";
import { getDb } from "@/lib/db/client";
import { getInvoiceByToken } from "@/lib/invoices";

export const metadata: Metadata = { title: "Invoice", robots: { index: false, follow: false } };

/** Customer-facing invoice (unguessable link). No site chrome, no tracking. Print → "Save as PDF". */
export default async function PublicInvoice(props: PageProps<"/invoice/[token]">) {
  const { token } = await props.params;
  const inv = await getInvoiceByToken(await getDb(), token);
  if (!inv) notFound();
  const [business, invoicing] = await Promise.all([
    getSetting("business"),
    getSetting("invoicing"),
  ]);
  return (
    <main className="bg-surface min-h-full py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] justify-end px-4 print:hidden">
        <PrintButton />
      </div>
      <InvoiceDocument invoice={inv} business={business} invoicing={invoicing} />
    </main>
  );
}
