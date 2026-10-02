import Link from "next/link";
import { notFound } from "next/navigation";
import { invoiceAction } from "@/app/admin/invoices/actions";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { adminButton } from "@/components/admin/ui";
import { InvoiceDocument } from "@/components/invoice-document";
import { requireAdmin } from "@/lib/auth/admin";
import { getSetting } from "@/lib/data/settings";
import { getDb } from "@/lib/db/client";
import { bookings } from "@/lib/db/schema";
import { getInvoice } from "@/lib/invoices";
import { eq } from "drizzle-orm";

export default async function InvoiceAdmin(props: PageProps<"/admin/invoices/[id]">) {
  await requireAdmin();
  const [{ id }, sp] = await Promise.all([props.params, props.searchParams]);
  const db = await getDb();
  const inv = /^[0-9a-f-]{36}$/.test(id) ? await getInvoice(db, id) : null;
  if (!inv) notFound();
  const [business, invoicing] = await Promise.all([
    getSetting("business"),
    getSetting("invoicing"),
  ]);
  const [booking] = inv.bookingId
    ? await db.select({ ref: bookings.ref }).from(bookings).where(eq(bookings.id, inv.bookingId))
    : [];
  const open = inv.status === "draft" || inv.status === "sent";
  const op = (name: string, label: string, primary = false) => (
    <button
      name="op"
      value={name}
      className={`${adminButton} ${primary ? "bg-brand text-white" : "border-line border bg-white"}`}
    >
      {label}
    </button>
  );
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link href="/admin/invoices" className="text-brand text-sm">
        ← Invoices
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-ink text-xl font-bold">
          {inv.number} <span className="text-muted text-base font-normal">· {inv.status}</span>
        </h1>
        {booking && (
          <Link href={`/admin/leads/${booking.ref}`} className="text-brand text-sm underline">
            Booking {booking.ref}
          </Link>
        )}
      </div>
      {sp.existing && (
        <p className="bg-surface rounded-lg p-3 text-sm">
          This booking already had an invoice — here it is.
        </p>
      )}
      {typeof sp.ok === "string" && (
        <p className="rounded-lg bg-green-50 p-3 text-sm text-green-900" role="status">
          {sp.ok}
        </p>
      )}
      {typeof sp.err === "string" && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-900" role="alert">
          {sp.err}
        </p>
      )}
      <form action={invoiceAction} className="flex flex-wrap gap-2">
        <input type="hidden" name="id" value={inv.id} />
        {open && op("send", "Email to customer", true)}
        {open && op("paid-transfer", "Paid by transfer")}
        {open && op("paid-cash", "Paid in cash")}
        <a
          href={`/invoice/${inv.publicToken}`}
          target="_blank"
          className={`${adminButton} border-line border bg-white`}
        >
          Open customer link
        </a>
        {open && (
          <ConfirmButton
            name="op"
            value="void"
            confirmText="Void this invoice? It stays in your records marked VOID."
            className={`${adminButton} border border-red-300 bg-white text-red-800`}
          >
            Void
          </ConfirmButton>
        )}
      </form>
      <div className="border-line overflow-x-auto rounded-xl border">
        <InvoiceDocument invoice={inv} business={business} invoicing={invoicing} />
      </div>
    </div>
  );
}
