import { HistoryPanel } from "@/components/admin/settings/history-panel";
import { HomeEditor } from "@/components/admin/settings/home-editor";
import { SettingsHeader } from "@/components/admin/settings/page-header";
import { requireAdmin } from "@/lib/auth/admin";
import { loadSettingWithHistory } from "@/lib/data/admin-settings";

export default async function HomeSettingsPage() {
  await requireAdmin();
  const { value, history } = await loadSettingWithHistory("home");
  return (
    <div className="mx-auto max-w-2xl">
      <SettingsHeader title="Home page text" />
      <HomeEditor initial={value} />
      <HistoryPanel entries={history} />
    </div>
  );
}
