import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { policyAction } from "@/app/admin/content/actions";
import { ContentHeader, Flash, MD_HINT } from "@/components/admin/content-ui";
import { adminButton, adminInput } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db/client";
import { policies, POLICY_SLUGS } from "@/lib/db/schema";

export default async function PolicyEdit(props: PageProps<"/admin/content/policies/[slug]">) {
  await requireAdmin();
  const [{ slug }, sp] = await Promise.all([props.params, props.searchParams]);
  if (!(POLICY_SLUGS as readonly string[]).includes(slug)) notFound();
  const [p] = await (
    await getDb()
  )
    .select()
    .from(policies)
    .where(eq(policies.slug, slug as (typeof POLICY_SLUGS)[number]))
    .limit(1);
  if (!p) notFound();
  return (
    <div className="mx-auto max-w-3xl">
      <ContentHeader
        title={p.title}
        back="/admin/content/policies"
        intro={
          <a href={`/policies/${p.slug}`} target="_blank" className="text-brand underline">
            View on site
          </a>
        }
      />
      <Flash sp={sp} />
      <form action={policyAction} className="space-y-3">
        <input type="hidden" name="slug" value={p.slug} />
        <label className="block space-y-1">
          <span className="text-sm font-semibold">Title</span>
          <input name="title" defaultValue={p.title} className={adminInput} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-semibold">Text</span>
          <textarea
            name="body"
            rows={24}
            defaultValue={p.body}
            className={`${adminInput} font-mono text-sm`}
          />
          <span className="text-muted block text-xs">
            {MD_HINT} {"{businessName} {abn} {phone} {email}"} are filled in automatically.
          </span>
        </label>
        <button className={`${adminButton} bg-brand text-white`}>Save</button>
      </form>
    </div>
  );
}
