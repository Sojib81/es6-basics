import Link from "next/link";
import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/admin-nav";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db/client";
import { countNew } from "@/lib/leads/admin-ops";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const admin = await requireAdmin();
  const counts = await countNew(await getDb());
  return (
    <div className="bg-surface flex min-h-full flex-1 flex-col">
      <header className="border-line flex h-14 items-center justify-between border-b bg-white px-4">
        <Link href="/admin/leads" className="text-brand font-bold">
          Admin
        </Link>
        <span className="text-muted truncate text-sm">{admin.name}</span>
      </header>
      <div className="flex flex-1">
        <AdminNav
          items={[
            { href: "/admin/leads", label: "Leads", badge: counts.newBookings },
            { href: "/admin/inbox", label: "Inbox", badge: counts.unreadEnquiries },
          ]}
        />
        <main className="min-w-0 flex-1 p-4 pb-24 md:p-6">{children}</main>
      </div>
    </div>
  );
}
