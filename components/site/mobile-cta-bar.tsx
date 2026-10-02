"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const HIDDEN_ON = ["/book", "/thank-you"]; // the form/confirmation is the call to action there

/** Sticky bottom bar on phones: the two main conversions, always one tap away. */
export function MobileCtaBar({ phone }: { phone: string }) {
  const path = usePathname();
  if (HIDDEN_ON.some((p) => path === p || path.startsWith(`${p}/`))) return null;
  return (
    <div className="h-mobile-bar border-line fixed inset-x-0 bottom-0 z-40 grid grid-cols-2 gap-3 border-t bg-white px-4 py-3 md:hidden">
      <a
        href={`tel:${phone}`}
        className="border-brand text-brand flex items-center justify-center rounded-lg border-2 font-semibold"
        data-track="click_call"
      >
        Call
      </a>
      <Link
        href="/pricing"
        className="bg-accent flex items-center justify-center rounded-lg font-semibold text-white"
      >
        Get price
      </Link>
    </div>
  );
}
