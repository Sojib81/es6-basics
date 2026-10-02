/**
 * Server-only admin guards. Call requireAdmin() at the top of EVERY admin page, and
 * requireAdminAction() at the top of EVERY admin server action (actions are reachable by direct POST).
 */
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getServerEnv } from "@/lib/config";
import { createDb } from "@/lib/db/client";
import { isSameOrigin, resolveAdmin, type AdminUser } from "./access";

export const getAdmin = cache(async (): Promise<AdminUser | null> => {
  const h = await headers();
  const { env, config } = await getServerEnv();
  return resolveAdmin(createDb(env.DB), h, config);
});

export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getAdmin();
  if (!admin) redirect("/access-denied");
  return admin;
}

export async function requireAdminAction(): Promise<AdminUser> {
  const h = await headers();
  if (!isSameOrigin(h)) throw new Error("Cross-origin request refused");
  const admin = await getAdmin();
  if (!admin) throw new Error("Not authorised");
  return admin;
}
