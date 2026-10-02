import Link from "next/link";
import { ContentHeader } from "@/components/admin/content-ui";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db/client";
import { policies } from "@/lib/db/schema";

export default async function PoliciesAdmin() {
  await requireAdmin();
  const rows = await (await getDb()).select().from(policies);
  return (
    <div className="mx-auto max-w-2xl">
      <ContentHeader
        title="Policies"
        intro="These are sensible starting drafts — have them checked for your business."
      />
      <ul className="space-y-2">
        {rows.map((p) => (
          <li key={p.slug}>
            <Link
              href={`/admin/content/policies/${p.slug}`}
              className="border-line hover:border-brand flex justify-between rounded-xl border bg-white p-4"
            >
              <span className="font-semibold">{p.title}</span>
              <span className="text-muted text-sm">updated {p.updatedAt.slice(0, 10)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
