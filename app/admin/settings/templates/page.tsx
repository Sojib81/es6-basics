import Link from "next/link";
import { asc } from "drizzle-orm";
import { SettingsHeader } from "@/components/admin/settings/page-header";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db/client";
import { messageTemplates } from "@/lib/db/schema";
import { TEMPLATE_META } from "@/lib/templates";

export default async function TemplatesPage() {
  await requireAdmin();
  const rows = await (
    await getDb()
  )
    .select()
    .from(messageTemplates)
    .orderBy(asc(messageTemplates.key));
  const groups = [
    {
      title: "To customers",
      rows: rows.filter((r) => TEMPLATE_META[r.key]?.audience === "customer"),
    },
    {
      title: "To you (owners)",
      rows: rows.filter((r) => TEMPLATE_META[r.key]?.audience !== "customer"),
    },
  ];
  return (
    <div className="mx-auto max-w-2xl">
      <SettingsHeader
        title="Message templates"
        intro="Edit the emails and texts the system sends."
      />
      {groups.map((g) => (
        <section key={g.title} className="mb-6">
          <h2 className="text-muted mb-2 text-sm font-semibold tracking-wide uppercase">
            {g.title}
          </h2>
          <ul className="divide-line border-line divide-y rounded-xl border bg-white">
            {g.rows.map((r) => (
              <li key={r.key}>
                <Link
                  href={`/admin/settings/templates/${r.key}`}
                  className="hover:bg-surface flex items-center justify-between gap-3 p-3"
                >
                  <span>{TEMPLATE_META[r.key]?.title ?? r.key}</span>
                  <span className="text-muted shrink-0 text-xs">
                    {r.channel.toUpperCase()}
                    {!r.enabled && " · off"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
