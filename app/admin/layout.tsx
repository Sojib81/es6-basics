import Link from "next/link";
import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/admin-nav";
import { PushToggle } from "@/components/admin/push-toggle";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db/client";
import { countNew } from "@/lib/leads/admin-ops";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
  manifest: "/admin-manifest.webmanifest",
  appleWebApp: { capable: true, title: "Admin", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
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
        <div className="flex min-w-0 items-center gap-3">
          <PushToggle />
          <span className="text-muted hidden truncate text-sm sm:inline">{admin.name}</span>
        </div>
      </header>
      <div className="flex flex-1">
        <AdminNav
          items={[
            { href: "/admin", label: "Home", exact: true },
            { href: "/admin/leads", label: "Leads", badge: counts.newBookings },
            { href: "/admin/inbox", label: "Inbox", badge: counts.unreadEnquiries },
            { href: "/admin/calendar", label: "Calendar" },
            { href: "/admin/customers", label: "Customers", mobile: false },
            { href: "/admin/invoices", label: "Invoices", mobile: false },
            { href: "/admin/settings", label: "Settings", mobile: false },
            { href: "/admin/more", label: "More", desktop: false },
          ]}
        />
        <main className="min-w-0 flex-1 p-4 pb-24 md:p-6">{children}</main>
      </div>
    </div>
  );
}
