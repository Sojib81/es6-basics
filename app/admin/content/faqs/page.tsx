import { asc } from "drizzle-orm";
import { faqAction } from "@/app/admin/content/actions";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { ContentHeader, Flash } from "@/components/admin/content-ui";
import { adminButton, adminInput, Card } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db/client";
import { faqs, services } from "@/lib/db/schema";

type Faq = typeof faqs.$inferSelect;

function FaqForm({
  f,
  serviceOptions,
}: {
  f?: Faq;
  serviceOptions: { slug: string; title: string }[];
}) {
  return (
    <form action={faqAction} className="space-y-2">
      {f && <input type="hidden" name="id" value={f.id} />}
      <input
        name="question"
        defaultValue={f?.question ?? ""}
        placeholder="Question"
        className={adminInput}
        aria-label="Question"
      />
      <textarea
        name="answer"
        rows={3}
        defaultValue={f?.answer ?? ""}
        placeholder="Answer"
        className={adminInput}
        aria-label="Answer"
      />
      <div className="flex flex-wrap items-center gap-3">
        <select
          name="serviceSlug"
          defaultValue={f?.serviceSlug ?? ""}
          className="border-line rounded-lg border px-2 py-2 text-sm"
          aria-label="Show on"
        >
          <option value="">General (home & FAQ page)</option>
          {serviceOptions.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.title} page
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" name="active" defaultChecked={f?.active ?? true} /> Show
        </label>
        <button name="op" value="save" className={`${adminButton} bg-brand text-white`}>
          {f ? "Save" : "Add question"}
        </button>
        {f && (
          <>
            <button
              name="op"
              value="up"
              className={`${adminButton} border-line border bg-white`}
              aria-label="Move up"
            >
              ↑
            </button>
            <button
              name="op"
              value="down"
              className={`${adminButton} border-line border bg-white`}
              aria-label="Move down"
            >
              ↓
            </button>
            <ConfirmButton
              name="op"
              value="delete"
              confirmText="Delete this question?"
              className={`${adminButton} border border-red-300 bg-white text-red-800`}
            >
              Delete
            </ConfirmButton>
          </>
        )}
      </div>
    </form>
  );
}

export default async function FaqsAdmin(props: PageProps<"/admin/content/faqs">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const db = await getDb();
  const [rows, svc] = await Promise.all([
    db.select().from(faqs).orderBy(asc(faqs.sortOrder)),
    db
      .select({ slug: services.slug, title: services.title })
      .from(services)
      .orderBy(asc(services.sortOrder)),
  ]);
  const groups = [{ slug: null as string | null, title: "General" }, ...svc].map((g) => ({
    ...g,
    items: rows.filter((r) => r.serviceSlug === g.slug),
  }));
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <ContentHeader title="FAQs" />
      <Flash sp={sp} />
      {groups
        .filter((g) => g.items.length)
        .map((g) => (
          <Card key={g.slug ?? "general"} title={g.title}>
            <ul className="divide-line space-y-4 divide-y">
              {g.items.map((f) => (
                <li key={f.id} className={`pt-4 first:pt-0 ${f.active ? "" : "opacity-60"}`}>
                  <FaqForm f={f} serviceOptions={svc} />
                </li>
              ))}
            </ul>
          </Card>
        ))}
      <Card title="Add a question">
        <FaqForm serviceOptions={svc} />
      </Card>
    </div>
  );
}
