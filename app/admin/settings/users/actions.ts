"use server";
import { revalidatePath } from "next/cache";
import { requireAdminAction } from "@/lib/auth/admin";
import { getDb } from "@/lib/db/client";
import { saveAdminUser, setAdminActive, type AdminUserInput } from "@/lib/users";

export async function saveUserAction(input: AdminUserInput) {
  const admin = await requireAdminAction();
  const r = await saveAdminUser(await getDb(), input, admin.email);
  revalidatePath("/admin/settings/users");
  return r;
}

export async function setUserActiveAction(email: string, active: boolean) {
  const admin = await requireAdminAction();
  const r = await setAdminActive(await getDb(), email, active, admin.email);
  revalidatePath("/admin/settings/users");
  return r;
}
