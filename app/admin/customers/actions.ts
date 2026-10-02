"use server";
import { redirect } from "next/navigation";
import { requireAdminAction } from "@/lib/auth/admin";
import { updateCustomer } from "@/lib/customers-admin";
import { getDb } from "@/lib/db/client";

export async function updateCustomerAction(fd: FormData) {
  const admin = await requireAdminAction();
  const id = String(fd.get("id") ?? "");
  if (!/^[0-9a-f-]{8,40}$/i.test(id) && !/^[a-z0-9]{1,40}$/i.test(id)) throw new Error("Bad id");
  const r = await updateCustomer(
    await getDb(),
    id,
    {
      name: String(fd.get("name") ?? ""),
      email: String(fd.get("email") ?? ""),
      type: String(fd.get("type") ?? ""),
      agency: String(fd.get("agency") ?? ""),
      notes: String(fd.get("notes") ?? ""),
      smsOptOut: fd.get("smsOptOut") === "on",
    },
    admin.email,
  );
  redirect(`/admin/customers/${id}?${r.ok ? "saved=1" : `msg=${encodeURIComponent(r.message)}`}`);
}
