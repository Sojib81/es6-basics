import Link from "next/link";
import type { BusinessInfo } from "@/lib/data/business";
import { formatAuPhone } from "@/lib/phone";
import { mainNav } from "./nav";

export function SiteHeader({ business }: { business: BusinessInfo }) {
  return (
    <header className="border-line sticky top-0 z-40 border-b bg-white/95 backdrop-blur">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-4 focus:rounded focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="text-brand text-lg font-bold">
          {business.businessName}
        </Link>
        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex items-center gap-6 text-sm font-medium">
            {mainNav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-ink hover:text-brand">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <a
          href={`tel:${business.phone}`}
          className="bg-accent hover:bg-accent-dark hidden rounded-lg px-4 py-2 text-sm font-semibold text-white md:inline-block"
          data-track="click_call"
        >
          Call {formatAuPhone(business.phone)}
        </a>
      </div>
    </header>
  );
}
