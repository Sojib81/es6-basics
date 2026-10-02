import Link from "next/link";
import { and, desc, eq, inArray, lt, type SQL } from "drizzle-orm";
import { restoreAction } from "@/app/admin/content/actions";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Flash } from "@/components/admin/content-ui";
import { adminButton, when } from "@/components/admin/ui";
import { diffSummary } from "@/lib/audit-diff";
import { requireAdmin } from "@/lib/auth/admin";
import { isRestorable } from "@/lib/content-admin";
import { getDb } from "@/lib/db/client";
import { auditLog, bookings, enquiries } from "@/lib/db/schema";

const ENTITY_LABEL: Record<string, string> = {
  settings: "Settings",
  booking: "Booking",
  enquiry: "Enquiry",
  customer: "Customer",
  invoice: "Invoice",
  service: "Service",
  faq: "FAQ",
  policy: "Policy",
  review: "Review",
  media: "File",
  message_template: "Template",
  admin_user: "User",
};

export default async function HistoryPage(props: PageProps<"/admin/history">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const entity = typeof sp.entity === "string" && ENTITY_LABEL[sp.entity] ? sp.entity : "";
  const before =
    typeof sp.before === "string" && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(sp.before)
      ? sp.before
      : "";
  const where: SQL[] = [];
  if (entity) where.push(eq(auditLog.entity, entity));
  if (before) where.push(lt(auditLog.createdAt, before));
  const db = await getDb();
  const rows = await db
    .select()
    .from(auditLog)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(auditLog.createdAt))
    .limit(50);

  // Turn booking/enquiry ids into refs for links
  const bIds = rows.filter((r) => r.entity === "booking").map((r) => r.entityId);
  const eIds = rows.filter((r) => r.entity === "enquiry").map((r) => r.entityId);
  const [bRefs, eRefs] = await Promise.all([
    bIds.length
      ? db
          .select({ id: bookings.id, ref: bookings.ref })
          .from(bookings)
          .where(inArray(bookings.id, bIds))
      : [],
    eIds.length
      ? db
          .select({ id: enquiries.id, ref: enquiries.ref })
          .from(enquiries)
          .where(inArray(enquiries.id, eIds))
      : [],
  ]);
  const link = (r: (typeof rows)[number]): { href: string; label: string } | null => {
    if (r.entity === "booking") {
      const ref = bRefs.find((x) => x.id === r.entityId)?.ref;
      return ref ? { href: `/admin/leads/${ref}`, label: ref } : null;
    }
    if (r.entity === "enquiry") {
      const ref = eRefs.find((x) => x.id === r.entityId)?.ref;
      return ref ? { href: `/admin/inbox/${ref}`, label: ref } : null;
    }
    if (r.entity === "invoice") return { href: `/admin/invoices/${r.entityId}`, label: "invoice" };
    if (r.entity === "customer")
      return { href: `/admin/customers/${r.entityId}`, label: "customer" };
    if (r.entity === "settings")
      return { href: `/admin/settings/${r.entityId}`, label: r.entityId };
    return null;
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <h1 className="text-ink text-xl font-bold">History</h1>
      <Flash sp={sp} />
      <nav aria-label="Filter" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-2">
          {[["", "Everything"], ...Object.entries(ENTITY_LABEL)].map(([k, label]) => (
            <li key={k}>
              <Link
                href={k ? `/admin/history?entity=${k}` : "/admin/history"}
                className={`block rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap ${entity === k ? "bg-brand text-white" : "text-ink ring-line bg-white ring-1"}`}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <ol className="space-y-2">
        {rows.map((r) => {
          const l = link(r);
          const changes = diffSummary(r.before, r.after);
          return (
            <li key={r.id} className="border-line rounded-xl border bg-white p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p>
                  <span className="font-semibold">{ENTITY_LABEL[r.entity] ?? r.entity}</span> ·{" "}
                  {r.action.replace("_", " ")}
                  {l && (
                    <>
                      {" · "}
                      <Link href={l.href} className="text-brand underline">
                        {l.label}
                      </Link>
                    </>
                  )}
                </p>
                <p className="text-muted text-xs">
                  {when(r.createdAt)} · {r.actorEmail}
                </p>
              </div>
              {changes.length > 0 && (
                <ul className="text-muted mt-1 space-y-0.5 font-mono text-xs">
                  {changes.map((c) => (
                    <li key={c} className="break-all">
                      {c}
                    </li>
                  ))}
                </ul>
              )}
              {isRestorable(r) && (
                <form action={restoreAction} className="mt-2">
                  <input type="hidden" name="id" value={r.id} />
                  <ConfirmButton
                    confirmText="Put this back the way it was before this change?"
                    className={`${adminButton} border-line border bg-white`}
                  >
                    Undo this change
                  </ConfirmButton>
                </form>
              )}
            </li>
          );
        })}
      </ol>
      {rows.length === 50 && (
        <Link
          href={`/admin/history?${entity ? `entity=${entity}&` : ""}before=${encodeURIComponent(rows.at(-1)!.createdAt)}`}
          className="text-brand inline-block underline"
        >
          Older →
        </Link>
      )}
    </div>
  );
}
