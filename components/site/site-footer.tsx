import Link from "next/link";
import type { BusinessInfo } from "@/lib/data/business";
import { formatAuPhone } from "@/lib/phone";
import { mainNav, policyNav } from "./nav";

export function SiteFooter({ business }: { business: BusinessInfo }) {
  return (
    <footer className="border-line bg-surface text-muted border-t text-sm">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-3">
        <div className="space-y-2">
          <p className="text-ink font-semibold">{business.businessName}</p>
          <p>{business.serviceAreaText}</p>
          <p>{business.insuranceText}</p>
          <p>ABN {business.abn}</p>
        </div>
        <nav aria-label="Footer">
          <ul className="space-y-2">
            {mainNav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-brand">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="space-y-2">
          <p>
            <a href={`tel:${business.phone}`} className="hover:text-brand" data-track="click_call">
              {formatAuPhone(business.phone)}
            </a>
          </p>
          <p>
            <a href={`mailto:${business.publicEmail}`} className="hover:text-brand">
              {business.publicEmail}
            </a>
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 pt-2">
            {policyNav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-brand">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
