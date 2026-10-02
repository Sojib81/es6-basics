/**
 * Cached settings loaders for server components and route handlers.
 * Rendering is per request (D1 is read on each request); React `cache()` de-duplicates reads
 * within one request, so the layout and page can both call getSetting("business") for free.
 * Admin saves are therefore live on the next page load — no cache invalidation needed.
 * See DEV_NOTES.md → Decisions (caching).
 */
import { cache } from "react";
import { readSetting } from "@/lib/audit";
import { getDb } from "@/lib/db/client";
import type { SettingKey, SettingValue } from "@/lib/schemas/settings";

const loadSetting = cache(async (key: SettingKey) => readSetting(await getDb(), key));

export function getSetting<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
  return loadSetting(key) as Promise<SettingValue<K>>;
}
