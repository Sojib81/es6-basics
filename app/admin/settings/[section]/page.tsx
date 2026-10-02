import { notFound } from "next/navigation";
import { HistoryPanel } from "@/components/admin/settings/history-panel";
import { SettingsHeader } from "@/components/admin/settings/page-header";
import { SIMPLE_SECTIONS } from "@/components/admin/settings/sections";
import { SimpleSettingsForm } from "@/components/admin/settings/simple-form";
import { requireAdmin } from "@/lib/auth/admin";
import { loadSettingWithHistory } from "@/lib/data/admin-settings";
import { SETTING_KEYS, type SettingKey } from "@/lib/schemas/settings";

export default async function SimpleSettingsPage(props: PageProps<"/admin/settings/[section]">) {
  await requireAdmin();
  const { section } = await props.params;
  const def = SIMPLE_SECTIONS[section];
  if (!def || !SETTING_KEYS.includes(section as SettingKey)) notFound();
  const { value, history } = await loadSettingWithHistory(section as SettingKey);
  return (
    <div className="mx-auto max-w-2xl">
      <SettingsHeader title={def.title} />
      <SimpleSettingsForm
        settingKey={section as SettingKey}
        initial={value as Record<string, unknown>}
        fields={def.fields}
      />
      <HistoryPanel entries={history} />
    </div>
  );
}
