import Link from "next/link";
import { asc } from "drizzle-orm";
import { ContentHeader } from "@/components/admin/content-ui";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db/client";
import { services } from "@/lib/db/schema";

export default async function ServicesAdmin() {
  await requireAdmin();
  const rows = await (await getDb()).select().from(services).orderBy(asc(services.sortOrder));
  return (
    <div className="mx-auto max-w-3xl">
      <ContentHeader title="Services" />
      <ul className="space-y-2">
        {rows.map((s) => (
          <li key={s.id}>
            <Link
              href={`/admin/content/services/${s.id}`}
              className="border-line hover:border-brand flex items-center justify-between rounded-xl border bg-white p-4"
            >
              <span className="font-semibold">{s.title}</span>
              <span className="text-muted text-sm">
                /services/{s.slug}
                {s.active ? "" : " · hidden"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
