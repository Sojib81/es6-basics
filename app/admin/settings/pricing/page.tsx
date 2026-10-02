import { HistoryPanel } from "@/components/admin/settings/history-panel";
import { SettingsHeader } from "@/components/admin/settings/page-header";
import { PricingEditor } from "@/components/admin/settings/pricing-editor";
import { requireAdmin } from "@/lib/auth/admin";
import { loadSettingWithHistory } from "@/lib/data/admin-settings";

export default async function PricingSettingsPage() {
  await requireAdmin();
  const { value, history } = await loadSettingWithHistory("pricing");
  return (
    <div className="mx-auto max-w-3xl">
      <SettingsHeader
        title="Prices"
        intro="Changes are live on the website as soon as you save. Existing bookings keep the price they were quoted."
      />
      <PricingEditor current={value} />
      <HistoryPanel entries={history} />
    </div>
  );
}
