import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";

const LINKS = [
  { href: "/admin/customers", title: "Customers", text: "Everyone who's booked or enquired" },
  { href: "/admin/invoices", title: "Invoices", text: "Create, send and track invoices" },
  { href: "/admin/settings", title: "Settings", text: "Prices, hours, messages, users" },
  { href: "/admin/history", title: "History", text: "Every change, with restore" },
  { href: "/admin/export", title: "Exports", text: "Bookings and invoices as CSV" },
];

export default async function MorePage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <h1 className="text-ink text-xl font-bold">More</h1>
      <ul className="space-y-2">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="border-line hover:border-brand block rounded-xl border bg-white p-4"
            >
              <p className="text-ink font-semibold">{l.title}</p>
              <p className="text-muted text-sm">{l.text}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
