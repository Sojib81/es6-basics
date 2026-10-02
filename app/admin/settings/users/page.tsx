import { SettingsHeader } from "@/components/admin/settings/page-header";
import { UsersEditor } from "@/components/admin/settings/users-editor";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db/client";
import { listAdminUsers } from "@/lib/users";

export default async function UsersPage() {
  const me = await requireAdmin();
  const users = await listAdminUsers(await getDb());
  return (
    <div className="mx-auto max-w-2xl">
      <SettingsHeader title="Users" intro="Everyone here has full access (owner)." />
      <UsersEditor users={users} me={me.email} />
    </div>
  );
}
