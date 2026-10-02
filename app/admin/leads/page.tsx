import Link from "next/link";
import { Badge, BOOKING_STATUS_STYLE, ago, adminInput } from "@/components/admin/ui";
import { formatIsoDate, SERVICE_LABELS } from "@/lib/notify/alerts";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db/client";
import type { BookingStatus } from "@/lib/db/schema";
import { listBookings } from "@/lib/leads/admin-ops";
import { formatCents } from "@/lib/money";

const TABS: { key: BookingStatus | "open" | "all"; label: string }[] = [
  { key: "new", label: "New" },
  { key: "open", label: "Open" },
  { key: "contacted", label: "Contacted" },
  { key: "confirmed", label: "Confirmed" },
  { key: "completed", label: "Completed" },
  { key: "lost", label: "Lost" },
  { key: "cancelled", label: "Cancelled" },
  { key: "all", label: "All" },
];

export default async function LeadsPage(props: PageProps<"/admin/leads">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const status = (TABS.find((t) => t.key === sp.status)?.key ?? "open") as
    BookingStatus | "open" | "all";
  const q = typeof sp.q === "string" ? sp.q.slice(0, 50) : "";
  const rows = await listBookings(await getDb(), { status, q });
  const now = new Date();

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-ink text-xl font-bold">Leads & bookings</h1>
        <Link
          href="/admin/leads/new"
          className="bg-brand rounded-lg px-3 py-2 text-sm font-semibold text-white"
        >
          + Phone booking
        </Link>
      </div>
      <form className="flex gap-2" role="search">
        <input type="hidden" name="status" value={status} />
        <label htmlFor="q" className="sr-only">
          Search
        </label>
        <input
          id="q"
          name="q"
          defaultValue={q}
          placeholder="Name, phone, ref or suburb"
          className={adminInput}
        />
        <button className="bg-brand rounded-lg px-4 font-semibold text-white">Search</button>
      </form>
      <nav aria-label="Filter by status" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-2">
          {TABS.map((t) => (
            <li key={t.key}>
              <Link
                href={`/admin/leads?status=${t.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                className={`block rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap ${
                  status === t.key ? "bg-brand text-white" : "text-ink ring-line bg-white ring-1"
                }`}
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {rows.length === 0 ? (
        <p className="text-muted rounded-xl bg-white p-6 text-center">No bookings here.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map(({ booking: b }) => (
            <li key={b.id}>
              <Link
                href={`/admin/leads/${b.ref}`}
                className="border-line hover:border-brand block rounded-xl border bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-ink truncate font-semibold">{b.submittedName}</p>
                    <p className="text-muted text-sm">
                      {SERVICE_LABELS[b.service]}
                      {b.bedrooms ? ` · ${b.bedrooms}×${b.bathrooms}` : ""} · {b.suburb}
                    </p>
                    <p className="text-muted text-sm">
                      {b.scheduledDate
                        ? `Booked ${formatIsoDate(b.scheduledDate)}`
                        : `Wants ${formatIsoDate(b.preferredDate)}`}
                      {b.estimateCents !== null && ` · ${formatCents(b.estimateCents)}`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge status={b.status} styles={BOOKING_STATUS_STYLE} />
                    <p className="text-muted mt-1 text-xs">{ago(b.createdAt, now)}</p>
                    <p className="text-muted font-mono text-xs">{b.ref}</p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
