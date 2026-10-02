import Link from "next/link";
import { notFound } from "next/navigation";
import {
  adminButton,
  adminInput,
  Badge,
  BOOKING_STATUS_STYLE,
  Card,
  ENQUIRY_STATUS_STYLE,
  when,
} from "@/components/admin/ui";
import { updateCustomerAction } from "@/app/admin/customers/actions";
import { requireAdmin } from "@/lib/auth/admin";
import { getCustomerProfile } from "@/lib/customers-admin";
import { getDb } from "@/lib/db/client";
import { formatCents } from "@/lib/money";
import { formatIsoDate, SERVICE_LABELS } from "@/lib/notify/alerts";
import { formatAuPhone } from "@/lib/phone";

export default async function CustomerPage(props: PageProps<"/admin/customers/[id]">) {
  await requireAdmin();
  const [{ id }, sp] = await Promise.all([props.params, props.searchParams]);
  const p = await getCustomerProfile(await getDb(), id);
  if (!p) notFound();
  const { customer: c } = p;
  const spent = p.invoices.filter((i) => i.status === "paid").reduce((n, i) => n + i.totalCents, 0);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/admin/customers" className="text-brand text-sm">
        ← Customers
      </Link>
      <div>
        <h1 className="text-ink text-xl font-bold">{c.name}</h1>
        <p className="text-muted text-sm">
          Customer since {when(c.createdAt)} · {p.bookings.length} bookings · {formatCents(spent)}{" "}
          paid
        </p>
      </div>
      {sp.saved && (
        <p className="rounded-lg bg-green-50 p-3 text-sm text-green-900" role="status">
          Saved.
        </p>
      )}
      {typeof sp.msg === "string" && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-900" role="alert">
          {sp.msg}
        </p>
      )}
      <div className="grid grid-cols-3 gap-2">
        <a href={`tel:${c.phone}`} className={`${adminButton} bg-brand text-white`}>
          Call
        </a>
        <a href={`sms:${c.phone}`} className={`${adminButton} border-line border bg-white`}>
          SMS
        </a>
        {c.email ? (
          <a href={`mailto:${c.email}`} className={`${adminButton} border-line border bg-white`}>
            Email
          </a>
        ) : (
          <span />
        )}
      </div>

      <Card title="Details">
        <form action={updateCustomerAction} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="id" value={c.id} />
          <label className="space-y-1">
            <span className="text-sm font-semibold">Name</span>
            <input name="name" defaultValue={c.name} className={adminInput} />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-semibold">Phone</span>
            <input value={formatAuPhone(c.phone)} readOnly className={`${adminInput} bg-surface`} />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-semibold">Email</span>
            <input name="email" type="email" defaultValue={c.email ?? ""} className={adminInput} />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-semibold">Type</span>
            <select name="type" defaultValue={c.type} className={adminInput}>
              <option value="individual">Customer</option>
              <option value="owner">Owner</option>
              <option value="property_manager">Property manager</option>
              <option value="business">Business</option>
            </select>
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-sm font-semibold">Agency</span>
            <input name="agency" defaultValue={c.agency ?? ""} className={adminInput} />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-sm font-semibold">Notes</span>
            <textarea name="notes" rows={3} defaultValue={c.notes ?? ""} className={adminInput} />
          </label>
          <label className="flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              name="smsOptOut"
              defaultChecked={c.smsOptOut}
              className="h-5 w-5 accent-[var(--color-brand)]"
            />
            Opted out of marketing texts (review requests)
          </label>
          <div>
            <button className={`${adminButton} bg-brand text-white`}>Save</button>
          </div>
        </form>
      </Card>

      <Card title={`Bookings (${p.bookings.length})`}>
        {p.bookings.length === 0 ? (
          <p className="text-muted text-sm">None.</p>
        ) : (
          <ul className="divide-line divide-y">
            {p.bookings.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/admin/leads/${b.ref}`}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <span className="text-sm">
                    <span className="font-mono">{b.ref}</span> · {SERVICE_LABELS[b.service]} ·{" "}
                    {b.suburb} · {formatIsoDate(b.scheduledDate ?? b.preferredDate)}
                    {b.pmCustomerId === c.id && b.bookerCustomerId !== c.id && " (as PM)"}
                  </span>
                  <Badge status={b.status} styles={BOOKING_STATUS_STYLE} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {p.enquiries.length > 0 && (
        <Card title={`Enquiries (${p.enquiries.length})`}>
          <ul className="divide-line divide-y">
            {p.enquiries.map((q) => (
              <li key={q.id}>
                <Link
                  href={`/admin/inbox/${q.ref}`}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <span className="truncate">
                    <span className="font-mono">{q.ref}</span> · {q.message}
                  </span>
                  <Badge status={q.status} styles={ENQUIRY_STATUS_STYLE} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {p.invoices.length > 0 && (
        <Card title={`Invoices (${p.invoices.length})`}>
          <ul className="divide-line divide-y">
            {p.invoices.map((i) => (
              <li key={i.id}>
                <Link
                  href={`/admin/invoices/${i.id}`}
                  className="flex justify-between gap-3 py-2 text-sm"
                >
                  <span>
                    {i.number} · {i.issuedAt}
                  </span>
                  <span>
                    {formatCents(i.totalCents)} · {i.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
