import { desc } from "drizzle-orm";
import { reviewAction } from "@/app/admin/content/actions";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { ContentHeader, Flash } from "@/components/admin/content-ui";
import { adminButton, adminInput, Card } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db/client";
import { reviews } from "@/lib/db/schema";
import { perthDateString } from "@/lib/time";

type Review = typeof reviews.$inferSelect;

function ReviewForm({ r }: { r?: Review }) {
  return (
    <form action={reviewAction} className="grid gap-2 sm:grid-cols-2">
      {r && <input type="hidden" name="id" value={r.id} />}
      <input
        name="name"
        defaultValue={r?.name ?? ""}
        placeholder="Reviewer's name (as shown on Google)"
        className={adminInput}
        aria-label="Name"
      />
      <input
        name="suburb"
        defaultValue={r?.suburb ?? ""}
        placeholder="Suburb (optional)"
        className={adminInput}
        aria-label="Suburb"
      />
      <textarea
        name="text"
        rows={3}
        defaultValue={r?.text ?? ""}
        placeholder="Paste the review exactly as written"
        className={`${adminInput} sm:col-span-2`}
        aria-label="Review text"
      />
      <select
        name="rating"
        defaultValue={String(r?.rating ?? 5)}
        className={adminInput}
        aria-label="Stars"
      >
        {[5, 4, 3, 2, 1].map((n) => (
          <option key={n} value={n}>
            {n} stars
          </option>
        ))}
      </select>
      <input
        type="date"
        name="date"
        defaultValue={r?.date ?? perthDateString(new Date())}
        className={adminInput}
        aria-label="Review date"
      />
      <input
        name="source"
        defaultValue={r?.source ?? "Google"}
        className={adminInput}
        aria-label="Source"
      />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="published" defaultChecked={r?.published ?? false} /> Show on
        the website
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <button name="op" value="save" className={`${adminButton} bg-brand text-white`}>
          {r ? "Save" : "Add review"}
        </button>
        {r && (
          <ConfirmButton
            name="op"
            value="delete"
            confirmText="Delete this review?"
            className={`${adminButton} border border-red-300 bg-white text-red-800`}
          >
            Delete
          </ConfirmButton>
        )}
      </div>
    </form>
  );
}

export default async function ReviewsAdmin(props: PageProps<"/admin/content/reviews">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const rows = await (await getDb()).select().from(reviews).orderBy(desc(reviews.date));
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <ContentHeader
        title="Reviews"
        intro="Only add real reviews from real customers, copied word for word (Australian Consumer Law). The reviews section only appears on the site once at least one is published."
      />
      <Flash sp={sp} />
      <Card title="Add a review">
        <ReviewForm />
      </Card>
      {rows.map((r) => (
        <Card key={r.id} className={r.published ? "" : "opacity-70"}>
          <ReviewForm r={r} />
        </Card>
      ))}
    </div>
  );
}
