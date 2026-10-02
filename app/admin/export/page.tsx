import { adminButton, adminInput, Card } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth/admin";
import { addDays } from "@/lib/booking-dates";
import { perthDateString } from "@/lib/time";

export default async function ExportPage() {
  await requireAdmin();
  const to = perthDateString(new Date());
  const quarterStart = `${to.slice(0, 5)}${String(Math.floor((Number(to.slice(5, 7)) - 1) / 3) * 3 + 1).padStart(2, "0")}-01`;
  const form = (action: string, label: string, hint: string) => (
    <Card title={label}>
      <form
        action={action}
        method="get"
        className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      >
        <label className="space-y-1">
          <span className="text-sm font-semibold">From</span>
          <input
            type="date"
            name="from"
            defaultValue={action.includes("invoices") ? quarterStart : addDays(to, -30)}
            className={adminInput}
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-semibold">To</span>
          <input type="date" name="to" defaultValue={to} className={adminInput} />
        </label>
        <button className={`${adminButton} bg-brand text-white`}>Download CSV</button>
      </form>
      <p className="text-muted mt-2 text-sm">{hint}</p>
    </Card>
  );
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-ink text-xl font-bold">Exports</h1>
      {form(
        "/admin/export/invoices.csv",
        "Invoices (for BAS / your accountant)",
        "By issue date. Includes GST and void invoices (shown as $0).",
      )}
      {form(
        "/admin/export/bookings.csv",
        "Bookings & leads",
        "By the date the request came in. Includes source, so you can see which ads bring jobs.",
      )}
    </div>
  );
}
