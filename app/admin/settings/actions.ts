"use server";
import { z } from "@/lib/zod";
import { restoreSetting, saveSettingWithHistory } from "@/lib/audit";
import { requireAdminAction } from "@/lib/auth/admin";
import { getDb } from "@/lib/db/client";
import { SETTING_KEYS, type SettingKey } from "@/lib/schemas/settings";

export type SaveResult =
  { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> };

function zodFields(e: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of e.issues) {
    const k = i.path.join(".");
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

export async function saveSettingAction(key: SettingKey, value: unknown): Promise<SaveResult> {
  const admin = await requireAdminAction();
  if (!SETTING_KEYS.includes(key)) return { ok: false, error: "Unknown setting" };
  try {
    await saveSettingWithHistory(await getDb(), key, value, admin.email);
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) {
      const fieldErrors = zodFields(e);
      const first = Object.entries(fieldErrors)[0];
      return {
        ok: false,
        error: first ? `${first[0] || "Value"}: ${first[1]}` : "Invalid value",
        fieldErrors,
      };
    }
    console.error("saveSettingAction", e);
    return { ok: false, error: "Couldn't save. Please try again." };
  }
}

export async function restoreSettingAction(historyId: string): Promise<SaveResult> {
  const admin = await requireAdminAction();
  try {
    await restoreSetting(await getDb(), historyId, admin.email);
    return { ok: true };
  } catch (e) {
    console.error("restoreSettingAction", e);
    return { ok: false, error: "Couldn't restore that version." };
  }
}
