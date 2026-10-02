import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { serviceAction } from "@/app/admin/content/actions";
import { ContentHeader, Flash, MD_HINT } from "@/components/admin/content-ui";
import { adminButton, adminInput, Card } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db/client";
import { media, services } from "@/lib/db/schema";
import { centsToDollars } from "@/lib/money-input";

export default async function ServiceEdit(props: PageProps<"/admin/content/services/[id]">) {
  await requireAdmin();
  const [{ id }, sp] = await Promise.all([props.params, props.searchParams]);
  const db = await getDb();
  const [s] = await db.select().from(services).where(eq(services.id, id)).limit(1);
  if (!s) notFound();
  const images = await db.select().from(media).where(eq(media.usage, "image"));
  const field = (
    name: string,
    label: string,
    value: string,
    opts: { rows?: number; hint?: string } = {},
  ) => (
    <label className="block space-y-1">
      <span className="text-sm font-semibold">{label}</span>
      {opts.rows ? (
        <textarea name={name} rows={opts.rows} defaultValue={value} className={adminInput} />
      ) : (
        <input name={name} defaultValue={value} className={adminInput} />
      )}
      {opts.hint && <span className="text-muted block text-xs">{opts.hint}</span>}
    </label>
  );
  return (
    <div className="mx-auto max-w-2xl">
      <ContentHeader
        title={s.title}
        back="/admin/content/services"
        intro={
          <a href={`/services/${s.slug}`} target="_blank" className="text-brand underline">
            View on site
          </a>
        }
      />
      <Flash sp={sp} />
      <form action={serviceAction} className="space-y-4">
        <input type="hidden" name="id" value={s.id} />
        <Card title="Page">
          <div className="space-y-3">
            {field("title", "Title", s.title)}
            {field("summary", "Summary", s.summary, { rows: 2 })}
            {field("body", "Main text", s.body, { rows: 10, hint: MD_HINT })}
            {field("checklist", "What's included (one per line)", s.checklist.join("\n"), {
              rows: 8,
            })}
            {field("notIncluded", "Not included (one per line)", s.notIncluded.join("\n"), {
              rows: 4,
            })}
            <label className="block space-y-1">
              <span className="text-sm font-semibold">Photo</span>
              <select name="heroMediaId" defaultValue={s.heroMediaId ?? ""} className={adminInput}>
                <option value="">No photo</option>
                {images.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.alt}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </Card>
        <Card title="Booking">
          <div className="grid gap-3 sm:grid-cols-2">
            {field(
              "priceFrom",
              '"From" price override ($)',
              s.priceFromCents !== null ? centsToDollars(s.priceFromCents) : "",
              { hint: "Leave blank to work it out from your prices." },
            )}
            {field("capacityWeight", "Counts as (jobs) in capacity", String(s.capacityWeight))}
            {field("sortOrder", "Order", String(s.sortOrder))}
          </div>
          <label className="mt-3 flex items-center gap-2">
            <input
              type="checkbox"
              name="bookable"
              defaultChecked={s.bookable}
              className="h-5 w-5 accent-[var(--color-brand)]"
            />{" "}
            Show the instant price calculator
          </label>
          <label className="mt-2 flex items-center gap-2">
            <input
              type="checkbox"
              name="active"
              defaultChecked={s.active}
              className="h-5 w-5 accent-[var(--color-brand)]"
            />{" "}
            Show on the website
          </label>
        </Card>
        <Card title="Google (SEO)">
          <div className="space-y-3">
            {field("seoTitle", "Page title (max 60)", s.seoTitle ?? "")}
            {field("seoDescription", "Description (max 155)", s.seoDescription ?? "", { rows: 2 })}
          </div>
        </Card>
        <button className={`${adminButton} bg-brand text-white`}>Save</button>
      </form>
    </div>
  );
}
