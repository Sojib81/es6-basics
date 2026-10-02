import { desc } from "drizzle-orm";
import { mediaAction } from "@/app/admin/content/actions";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { ContentHeader, Flash } from "@/components/admin/content-ui";
import { MediaUploader } from "@/components/admin/media-uploader";
import { adminButton, adminInput, Card } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth/admin";
import { mediaUrl } from "@/lib/data/content";
import { getSetting } from "@/lib/data/settings";
import { getDb } from "@/lib/db/client";
import { media } from "@/lib/db/schema";

const kb = (n: number) =>
  n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;

export default async function MediaAdmin(props: PageProps<"/admin/content/media">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const [rows, business, seo] = await Promise.all([
    (await getDb()).select().from(media).orderBy(desc(media.createdAt)),
    getSetting("business"),
    getSetting("seo"),
  ]);
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <ContentHeader
        title="Photos & files"
        intro="Use real photos of your own work only. Stock photos are fine for backgrounds, but never label them as your work."
      />
      <Flash sp={sp} />
      <Card title="Upload">
        <MediaUploader />
      </Card>
      <ul className="grid gap-3 sm:grid-cols-2">
        {rows.map((m) => (
          <li key={m.id}>
            <Card>
              {m.mimeType.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element -- R2 file, already resized
                <img
                  src={mediaUrl(m)}
                  alt={m.alt}
                  className="mb-2 h-40 w-full rounded object-cover"
                  loading="lazy"
                />
              ) : (
                <a
                  href={mediaUrl(m)}
                  target="_blank"
                  className="bg-surface text-brand mb-2 block rounded p-6 text-center font-semibold"
                >
                  📄 {m.filename}
                </a>
              )}
              <p className="text-muted text-xs">
                {m.usage === "pm-pack" ? "PM pack" : m.usage} · {kb(m.sizeBytes)}
                {m.width ? ` · ${m.width}×${m.height}` : ""}
                {business.logoMediaId === m.id && " · LOGO"}
                {seo.ogImageMediaId === m.id && " · SHARE IMAGE"}
              </p>
              <form action={mediaAction} className="mt-2 space-y-2">
                <input type="hidden" name="id" value={m.id} />
                <input
                  name="alt"
                  defaultValue={m.alt}
                  className={adminInput}
                  aria-label="Description"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    name="op"
                    value="alt"
                    className={`${adminButton} border-line border bg-white`}
                  >
                    Save description
                  </button>
                  {m.mimeType.startsWith("image/") && business.logoMediaId !== m.id && (
                    <button
                      name="op"
                      value="logo"
                      className={`${adminButton} border-line border bg-white`}
                    >
                      Use as logo
                    </button>
                  )}
                  {m.mimeType.startsWith("image/") && seo.ogImageMediaId !== m.id && (
                    <button
                      name="op"
                      value="og"
                      className={`${adminButton} border-line border bg-white`}
                    >
                      Use as share image
                    </button>
                  )}
                  <ConfirmButton
                    name="op"
                    value="delete"
                    confirmText="Delete this file?"
                    className={`${adminButton} border border-red-300 bg-white text-red-800`}
                  >
                    Delete
                  </ConfirmButton>
                </div>
              </form>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
