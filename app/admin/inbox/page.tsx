import Link from "next/link";
import { ago, Badge, ENQUIRY_STATUS_STYLE } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db/client";
import { listEnquiries, type EnquiryStatus } from "@/lib/leads/admin-ops";
import { ENQUIRY_TYPE_LABELS } from "@/lib/notify/alerts";

const TABS: { key: EnquiryStatus | "open" | "all"; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "unread", label: "Unread" },
  { key: "replied", label: "Replied" },
  { key: "closed", label: "Closed" },
  { key: "all", label: "All" },
];

export default async function InboxPage(props: PageProps<"/admin/inbox">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const status = TABS.find((t) => t.key === sp.status)?.key ?? "open";
  const rows = await listEnquiries(await getDb(), { status });
  const now = new Date();
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <h1 className="text-ink text-xl font-bold">Inbox</h1>
      <nav aria-label="Filter by status" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-2">
          {TABS.map((t) => (
            <li key={t.key}>
              <Link
                href={`/admin/inbox?status=${t.key}`}
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
        <p className="text-muted rounded-xl bg-white p-6 text-center">Nothing here.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((q) => (
            <li key={q.id}>
              <Link
                href={`/admin/inbox/${q.ref}`}
                className="border-line hover:border-brand block rounded-xl border bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      className={`text-ink truncate ${q.status === "unread" ? "font-bold" : "font-semibold"}`}
                    >
                      {q.submittedName}
                    </p>
                    <p className="text-muted text-sm">
                      {ENQUIRY_TYPE_LABELS[q.type]}
                      {q.suburb ? ` · ${q.suburb}` : ""}
                    </p>
                    <p className="text-muted truncate text-sm">{q.message}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge status={q.status} styles={ENQUIRY_STATUS_STYLE} />
                    <p className="text-muted mt-1 text-xs">{ago(q.createdAt, now)}</p>
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
