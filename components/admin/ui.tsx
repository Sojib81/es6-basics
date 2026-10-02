/** Admin UI bits: status colours (BLUEPRINT 15), cards, time formatting. */
import type { ReactNode } from "react";
import { formatPerth } from "@/lib/time";

export const BOOKING_STATUS_STYLE: Record<string, { label: string; className: string }> = {
  new: { label: "New", className: "bg-blue-100 text-blue-900" },
  contacted: { label: "Contacted", className: "bg-amber-100 text-amber-900" },
  confirmed: { label: "Confirmed", className: "bg-green-100 text-green-900" },
  completed: { label: "Completed", className: "bg-slate-200 text-slate-800" },
  cancelled: { label: "Cancelled", className: "bg-red-100 text-red-900" },
  lost: { label: "Lost", className: "bg-red-100 text-red-900" },
};

export const ENQUIRY_STATUS_STYLE: Record<string, { label: string; className: string }> = {
  unread: { label: "Unread", className: "bg-blue-100 text-blue-900" },
  read: { label: "Read", className: "bg-amber-100 text-amber-900" },
  replied: { label: "Replied", className: "bg-green-100 text-green-900" },
  closed: { label: "Closed", className: "bg-slate-200 text-slate-800" },
};

export function Badge({
  status,
  styles,
}: {
  status: string;
  styles: Record<string, { label: string; className: string }>;
}) {
  const s = styles[status] ?? { label: status, className: "bg-slate-100 text-slate-800" };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.className}`}
    >
      {s.label}
    </span>
  );
}

export function Card({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`border-line rounded-xl border bg-white p-4 ${className}`}>
      {title && (
        <h2 className="text-muted mb-3 text-sm font-semibold tracking-wide uppercase">{title}</h2>
      )}
      {children}
    </section>
  );
}

export function when(iso: string | null | undefined): string {
  return iso ? formatPerth(new Date(iso)) : "";
}

/** "5 min ago", "3 h ago", "2 d ago" */
export function ago(iso: string, now: Date = new Date()): string {
  const mins = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

export const adminButton =
  "inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50";
export const adminInput =
  "block w-full rounded-lg border border-line px-3 py-2.5 text-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";
