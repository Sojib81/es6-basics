import Link from "next/link";
import { ago, Card } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth/admin";
import { myJobs } from "@/lib/jobs";
import { perthDateString } from "@/lib/time";
import { getSetting } from "@/lib/data/settings";
import { getDb } from "@/lib/db/client";
import { getDashboard } from "@/lib/leads/dashboard";
import { SERVICE_LABELS } from "@/lib/notify/alerts";

function Stat({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: string | number;
  href?: string;
  tone?: "alert";
}) {
  const body = (
    <div
      className={`rounded-xl border bg-white p-4 ${tone === "alert" ? "border-accent" : "border-line"}`}
    >
      <p className={`text-3xl font-extrabold ${tone === "alert" ? "text-accent" : "text-ink"}`}>
        {value}
      </p>
      <p className="text-muted text-sm">{label}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default async function Dashboard() {
  const me = await requireAdmin();
  const now = new Date();
  const db = await getDb();
  const [d, booking, mine] = await Promise.all([
    getDashboard(db, now),
    getSetting("booking"),
    myJobs(db, me.email, perthDateString(now)),
  ]);
  const windowLabel = (id: string | null) =>
    booking.timeWindows.find((w) => w.id === id)?.label ?? id ?? "";
  const attention = [
    ...d.needsAttention.bookings.map((b) => ({
      key: b.id,
      href: `/admin/leads/${b.ref}`,
      name: b.submittedName,
      what: SERVICE_LABELS[b.service],
      at: b.createdAt,
    })),
    ...d.needsAttention.enquiries.map((q) => ({
      key: q.id,
      href: `/admin/inbox/${q.ref}`,
      name: q.submittedName,
      what: "Enquiry",
      at: q.createdAt,
    })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <h1 className="text-ink text-xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="New leads to call"
          value={d.newLeads}
          href="/admin/leads?status=new"
          tone={d.newLeads ? "alert" : undefined}
        />
        <Stat
          label="Unread enquiries"
          value={d.unreadEnquiries}
          href="/admin/inbox?status=unread"
          tone={d.unreadEnquiries ? "alert" : undefined}
        />
        <Stat label="Jobs today" value={d.jobsToday.length} />
        <Stat
          label={`Avg first response (30 days, ${d.respondedCount} leads)`}
          value={d.avgFirstResponseMinutes === null ? "—" : `${d.avgFirstResponseMinutes} min`}
        />
      </div>

      {attention.length > 0 && (
        <Card title={`Needs attention — waiting over ${d.unansweredReminderMinutes} min`}>
          <ul className="divide-line divide-y">
            {attention.map((a) => (
              <li key={a.key}>
                <Link href={a.href} className="flex justify-between gap-3 py-2">
                  <span className="font-medium">
                    {a.name} <span className="text-muted">· {a.what}</span>
                  </span>
                  <span className="text-accent shrink-0 text-sm font-semibold">
                    {ago(a.at, now)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {mine.length > 0 && (
        <Card title={`My jobs today (${mine.length})`}>
          <ul className="space-y-2">
            {mine.map((j) => (
              <li key={j.id}>
                <Link href={`/admin/leads/${j.ref}`} className="bg-surface block rounded-lg p-3">
                  <p className="font-semibold">
                    {windowLabel(j.scheduledWindow)} · {SERVICE_LABELS[j.service]}
                  </p>
                  <p className="text-sm">
                    {j.address}, {j.suburb}
                  </p>
                  <p className="text-muted text-sm">
                    {j.siteContactName ?? j.submittedName}
                    {j.assignees.length === 0 && " · not assigned yet"}
                  </p>
                </Link>
                {j.address && (
                  <a
                    className="text-brand mt-1 inline-block text-sm underline"
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${j.address}, ${j.suburb} WA`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Directions
                  </a>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {(
          [
            ["Today", d.jobsToday],
            ["Tomorrow", d.jobsTomorrow],
          ] as const
        ).map(([label, jobs]) => (
          <Card key={label} title={`${label} (${jobs.length})`}>
            {jobs.length === 0 ? (
              <p className="text-muted text-sm">No confirmed jobs.</p>
            ) : (
              <ul className="space-y-2">
                {jobs.map((j) => (
                  <li key={j.id}>
                    <Link
                      href={`/admin/leads/${j.ref}`}
                      className="bg-surface block rounded-lg p-2"
                    >
                      <p className="font-medium">
                        {windowLabel(j.scheduledWindow)} · {j.suburb}
                      </p>
                      <p className="text-muted text-sm">
                        {SERVICE_LABELS[j.service]} · {j.submittedName}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>

      <Card title="This week's leads by source">
        {d.sourcesThisWeek.length === 0 ? (
          <p className="text-muted text-sm">No leads yet this week.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted text-left">
                <th className="py-1 font-medium">Source</th>
                <th className="py-1 text-right font-medium">Leads</th>
                <th className="py-1 text-right font-medium">Booked</th>
              </tr>
            </thead>
            <tbody>
              {d.sourcesThisWeek.map((s) => (
                <tr key={s.source} className="border-line border-t">
                  <td className="py-1.5">{s.source}</td>
                  <td className="py-1.5 text-right tabular-nums">{s.leads}</td>
                  <td className="py-1.5 text-right tabular-nums">{s.won}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {d.depositsPaidThisWeek > 0 && (
          <p className="text-muted mt-2 text-sm">
            Deposits paid this week: {d.depositsPaidThisWeek}
          </p>
        )}
      </Card>
    </div>
  );
}
