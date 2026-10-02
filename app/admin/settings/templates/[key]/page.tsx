import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { SettingsHeader } from "@/components/admin/settings/page-header";
import { TemplateEditor } from "@/components/admin/settings/template-editor";
import { requireAdmin } from "@/lib/auth/admin";
import { getBusinessInfo } from "@/lib/data/business";
import { getDb } from "@/lib/db/client";
import { messageTemplates } from "@/lib/db/schema";
import { formatAuPhone } from "@/lib/phone";
import { TEMPLATE_META } from "@/lib/templates";

export default async function TemplatePage(props: PageProps<"/admin/settings/templates/[key]">) {
  await requireAdmin();
  const { key } = await props.params;
  const meta = TEMPLATE_META[key];
  if (!meta) notFound();
  const [row] = await (
    await getDb()
  )
    .select()
    .from(messageTemplates)
    .where(eq(messageTemplates.key, key))
    .limit(1);
  if (!row) notFound();
  const business = await getBusinessInfo();
  return (
    <div className="mx-auto max-w-2xl">
      <SettingsHeader title={meta.title} />
      <TemplateEditor
        templateKey={key}
        channel={row.channel}
        initial={{ subject: row.subject, body: row.body, enabled: row.enabled }}
        variables={meta.variables}
        transactional={meta.transactional}
        businessName={business.businessName}
        phone={formatAuPhone(business.phone)}
      />
    </div>
  );
}
