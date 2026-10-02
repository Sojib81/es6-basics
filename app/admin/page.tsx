import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";

// The dashboard arrives in Phase 6; until then, leads are the home screen.
export default async function AdminHome() {
  await requireAdmin();
  redirect("/admin/leads");
}
