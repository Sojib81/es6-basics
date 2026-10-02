"use server";
import { redirect } from "next/navigation";
import { requireAdminAction } from "@/lib/auth/admin";
import { getServerEnv, siteUrl } from "@/lib/config";
import { createDb } from "@/lib/db/client";
import { markInvoicePaid, sendInvoice, setInvoiceStatus } from "@/lib/invoices";
import { notifyContextFrom } from "@/lib/notify/context";

const idFrom = (fd: FormData) => {
  const id = String(fd.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error("Bad id");
  return id;
};
const back = (id: string, r: { ok: boolean; message: string }) =>
  redirect(`/admin/invoices/${id}?${r.ok ? "ok" : "err"}=${encodeURIComponent(r.message)}`);

export async function invoiceAction(fd: FormData) {
  const admin = await requireAdminAction();
  const id = idFrom(fd);
  const op = String(fd.get("op") ?? "");
  const { env, config } = await getServerEnv();
  const db = createDb(env.DB);
  if (op === "send")
    back(id, await sendInvoice(notifyContextFrom(db, config), id, admin.email, siteUrl()));
  if (op === "paid-cash" || op === "paid-transfer")
    back(id, await markInvoicePaid(db, id, op === "paid-cash" ? "cash" : "transfer", admin.email));
  if (op === "void") back(id, await setInvoiceStatus(db, id, "void", admin.email));
  if (op === "sent") back(id, await setInvoiceStatus(db, id, "sent", admin.email));
  throw new Error("Unknown operation");
}
