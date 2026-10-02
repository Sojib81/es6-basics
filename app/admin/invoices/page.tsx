import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db/client";
import { listInvoices, type InvoiceFilter } from "@/lib/invoices";
import { formatCents } from "@/lib/money";
import { perthDateString } from "@/lib/time";

const TABS: { key: InvoiceFilter; label: string }[] = [
  { key: "unpaid", label: "Unpaid" },
  { key: "overdue", label: "Overdue" },
  { key: "paid_this_month", label: "Paid this month" },
  { key: "all", label: "All" },
];

export default async function InvoicesPage(props: PageProps<"/admin/invoices">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const filter = TABS.find((t) => t.key === sp.filter)?.key ?? "unpaid";
  const rows = await listInvoices(await getDb(), filter);
  const today = perthDateString(new Date());
  const total = rows
    .filter((r) => r.status !== "void")
    .reduce((n, r) => n + (filter === "paid_this_month" ? r.totalCents : r.amountDueCents), 0);
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-ink text-xl font-bold">Invoices</h1>
        <Link href="/admin/export" className="text-brand text-sm underline">
          Export CSV
        </Link>
      </div>
      <nav aria-label="Filter" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-2">
          {TABS.map((t) => (
            <li key={t.key}>
              <Link
                href={`/admin/invoices?filter=${t.key}`}
                className={`block rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap ${filter === t.key ? "bg-brand text-white" : "text-ink ring-line bg-white ring-1"}`}
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {filter !== "all" && (
        <p className="text-muted text-sm">
          {filter === "paid_this_month" ? "Paid" : "Outstanding"}:{" "}
          <strong className="text-ink">{formatCents(total)}</strong>
        </p>
      )}
      {rows.length === 0 ? (
        <p className="text-muted rounded-xl bg-white p-6 text-center">
          No invoices here. Create one from a booking.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((i) => (
            <li key={i.id}>
              <Link
                href={`/admin/invoices/${i.id}`}
                className="border-line hover:border-brand flex items-center justify-between gap-3 rounded-xl border bg-white p-4"
              >
                <div className="min-w-0">
                  <p className="text-ink font-semibold">
                    {i.number} · {i.billToName}
                  </p>
                  <p className="text-muted text-sm">
                    Issued {i.issuedAt} · due {i.dueAt}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold tabular-nums">{formatCents(i.amountDueCents)}</p>
                  <p
                    className={`text-xs ${i.status !== "paid" && i.status !== "void" && i.dueAt < today ? "font-semibold text-red-700" : "text-muted"}`}
                  >
                    {i.status !== "paid" && i.status !== "void" && i.dueAt < today
                      ? "overdue"
                      : i.status}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
