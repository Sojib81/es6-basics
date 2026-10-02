import { BookingSettingsEditor } from "@/components/admin/settings/booking-editor";
import { HistoryPanel } from "@/components/admin/settings/history-panel";
import { SettingsHeader } from "@/components/admin/settings/page-header";
import { requireAdmin } from "@/lib/auth/admin";
import { loadSettingWithHistory } from "@/lib/data/admin-settings";

export default async function BookingSettingsPage() {
  await requireAdmin();
  const { value, history } = await loadSettingWithHistory("booking");
  return (
    <div className="mx-auto max-w-2xl">
      <SettingsHeader title="Bookings" />
      <BookingSettingsEditor initial={value} />
      <HistoryPanel entries={history} />
    </div>
  );
}
