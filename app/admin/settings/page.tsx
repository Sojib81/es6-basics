import Link from "next/link";
import { SETTINGS_SECTIONS } from "@/components/admin/settings/sections";
import { requireAdmin } from "@/lib/auth/admin";

export default async function SettingsIndex() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-ink text-xl font-bold">Settings</h1>
      <ul className="grid gap-2 sm:grid-cols-2">
        {SETTINGS_SECTIONS.map((s) => (
          <li key={s.key}>
            <Link
              href={s.href}
              className="border-line hover:border-brand block h-full rounded-xl border bg-white p-4"
            >
              <p className="text-ink font-semibold">{s.title}</p>
              <p className="text-muted text-sm">{s.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
