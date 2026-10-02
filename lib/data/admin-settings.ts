import { listSettingHistory, readSetting } from "@/lib/audit";
import { getDb } from "@/lib/db/client";
import type { SettingKey, SettingValue } from "@/lib/schemas/settings";

export async function loadSettingWithHistory<K extends SettingKey>(key: K) {
  const db = await getDb();
  const [value, history] = await Promise.all([readSetting(db, key), listSettingHistory(db, key)]);
  return { value: value as SettingValue<K>, history };
}
