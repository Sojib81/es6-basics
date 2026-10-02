"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; badge?: number };

export function AdminNav({ items }: { items: Item[] }) {
  const path = usePathname();
  const active = (href: string) => path === href || path.startsWith(`${href}/`);
  const badge = (n?: number) =>
    n ? (
      <span
        className="bg-accent ml-1 rounded-full px-1.5 text-xs font-bold text-white"
        aria-label={`${n} new`}
      >
        {n}
      </span>
    ) : null;
  return (
    <>
      {/* desktop sidebar */}
      <nav
        aria-label="Admin"
        className="border-line bg-surface hidden w-52 shrink-0 border-r p-3 md:block"
      >
        <ul className="space-y-1">
          {items.map((i) => (
            <li key={i.href}>
              <Link
                href={i.href}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium ${
                  active(i.href) ? "bg-brand text-white" : "text-ink hover:bg-white"
                }`}
              >
                {i.label}
                {badge(i.badge)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {/* mobile bottom tabs */}
      <nav
        aria-label="Admin"
        className="border-line fixed inset-x-0 bottom-0 z-40 border-t bg-white md:hidden"
      >
        <ul
          className="grid"
          style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
        >
          {items.map((i) => (
            <li key={i.href}>
              <Link
                href={i.href}
                className={`flex h-16 flex-col items-center justify-center text-xs font-semibold ${
                  active(i.href) ? "text-brand" : "text-muted"
                }`}
              >
                <span className="flex items-center">
                  {i.label}
                  {badge(i.badge)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
