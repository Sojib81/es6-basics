import Link from "next/link";
import { adminInput } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth/admin";
import { listCustomers } from "@/lib/customers-admin";
import { getDb } from "@/lib/db/client";
import { formatAuPhone } from "@/lib/phone";

const TYPE_LABEL: Record<string, string> = {
  individual: "Customer",
  owner: "Owner",
  property_manager: "Property manager",
  business: "Business",
};

export default async function CustomersPage(props: PageProps<"/admin/customers">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 50) : "";
  const type = typeof sp.type === "string" ? sp.type : "";
  const rows = await listCustomers(await getDb(), { q, type });
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <h1 className="text-ink text-xl font-bold">Customers</h1>
      <form className="flex flex-wrap gap-2" role="search">
        <label htmlFor="cq" className="sr-only">
          Search
        </label>
        <input
          id="cq"
          name="q"
          defaultValue={q}
          placeholder="Name, phone, email or agency"
          className={`${adminInput} flex-1`}
        />
        <select
          name="type"
          defaultValue={type}
          className="border-line rounded-lg border px-2"
          aria-label="Type"
        >
          <option value="">Everyone</option>
          <option value="property_manager">Property managers</option>
          <option value="individual">Customers</option>
          <option value="owner">Owners</option>
          <option value="business">Businesses</option>
        </select>
        <button className="bg-brand rounded-lg px-4 font-semibold text-white">Search</button>
      </form>
      {rows.length === 0 ? (
        <p className="text-muted rounded-xl bg-white p-6 text-center">No customers found.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map(({ c, bookingCount }) => (
            <li key={c.id}>
              <Link
                href={`/admin/customers/${c.id}`}
                className="border-line hover:border-brand flex items-center justify-between gap-3 rounded-xl border bg-white p-4"
              >
                <div className="min-w-0">
                  <p className="text-ink truncate font-semibold">
                    {c.name}
                    {c.type === "property_manager" && (
                      <span className="ml-2 rounded bg-indigo-100 px-1.5 text-xs text-indigo-900">
                        PM
                      </span>
                    )}
                    {bookingCount > 1 && (
                      <span className="ml-2 rounded bg-green-100 px-1.5 text-xs text-green-900">
                        repeat
                      </span>
                    )}
                  </p>
                  <p className="text-muted truncate text-sm">
                    {formatAuPhone(c.phone)}
                    {c.agency ? ` · ${c.agency}` : ""}
                    {c.email ? ` · ${c.email}` : ""}
                  </p>
                </div>
                <div className="text-muted shrink-0 text-right text-sm">
                  {TYPE_LABEL[c.type]}
                  <br />
                  {bookingCount} booking{bookingCount === 1 ? "" : "s"}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
