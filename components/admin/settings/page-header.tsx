import Link from "next/link";

export function SettingsHeader({ title, intro }: { title: string; intro?: string }) {
  return (
    <div className="mb-6">
      <Link href="/admin/settings" className="text-brand text-sm">
        ← Settings
      </Link>
      <h1 className="text-ink mt-1 text-xl font-bold">{title}</h1>
      {intro && <p className="text-muted mt-1 text-sm">{intro}</p>}
    </div>
  );
}
