"use server";
import { headers } from "next/headers";
import { z } from "@/lib/zod";
import { requireAdminAction } from "@/lib/auth/admin";
import { getDb } from "@/lib/db/client";
import { removeSubscription, saveSubscription } from "@/lib/push/admin-push";

const subSchema = z.object({
  endpoint: z.url().startsWith("https://").max(1000),
  p256dh: z.string().regex(/^[A-Za-z0-9_-]{80,100}$/),
  auth: z.string().regex(/^[A-Za-z0-9_-]{16,32}$/),
});

export async function subscribePushAction(raw: unknown): Promise<{ ok: boolean }> {
  const admin = await requireAdminAction();
  const sub = subSchema.parse(raw);
  await saveSubscription(await getDb(), admin.email, sub, (await headers()).get("user-agent"));
  return { ok: true };
}

export async function unsubscribePushAction(endpoint: string): Promise<{ ok: boolean }> {
  const admin = await requireAdminAction();
  await removeSubscription(await getDb(), admin.email, String(endpoint).slice(0, 1000));
  return { ok: true };
}
