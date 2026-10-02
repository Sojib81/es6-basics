/**
 * Audit log + settings history (BLUEPRINT.md golden rule 6).
 * Every admin write = validate → save → audit (before/after) → revalidate cache.
 * Statements are returned unexecuted where useful so callers can put them in one `db.batch()`
 * (D1 has no interactive transactions; a batch is atomic).
 */
import { desc, eq } from "drizzle-orm";
import type { Db } from "./db/client";
import { newId, nowIso } from "./db/ids";
import { AUDIT_ACTIONS, auditLog, settings, settingsHistory } from "./db/schema";
import { parseSetting, type SettingKey, type SettingValue } from "./schemas/settings";

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditEntry = {
  actorEmail: string;
  action: AuditAction;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
};

/** Unexecuted insert — await it, or pass it to `db.batch([...])` with the change it describes. */
export function auditInsert(db: Db, entry: AuditEntry) {
  return db.insert(auditLog).values({
    id: newId(),
    actorEmail: entry.actorEmail,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    before: entry.before ?? null,
    after: entry.after ?? null,
    createdAt: nowIso(),
  });
}

export async function writeAudit(db: Db, entry: AuditEntry): Promise<void> {
  await auditInsert(db, entry);
}

export class SettingMissingError extends Error {
  constructor(key: string) {
    super(`Setting "${key}" is missing from the database. Run the seed (npm run db:seed:local).`);
    this.name = "SettingMissingError";
  }
}

/** Reads and validates one setting. Throws if missing or invalid. */
export async function readSetting<K extends SettingKey>(db: Db, key: K): Promise<SettingValue<K>> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  if (!row) throw new SettingMissingError(key);
  return parseSetting(key, row.value);
}

/** Id of the latest settings_history row for a key (the current "version"), or null. */
export async function currentSettingVersionId(db: Db, key: SettingKey): Promise<string | null> {
  const [row] = await db
    .select({ id: settingsHistory.id })
    .from(settingsHistory)
    .where(eq(settingsHistory.key, key))
    .orderBy(desc(settingsHistory.changedAt), desc(settingsHistory.id))
    .limit(1);
  return row?.id ?? null;
}

/**
 * Validates and saves a setting, writing settings_history + audit_log in the same atomic batch.
 * Returns the new history id (= the new version id).
 */
export async function saveSettingWithHistory<K extends SettingKey>(
  db: Db,
  key: K,
  value: unknown,
  actorEmail: string,
  action: "update" | "restore" = "update",
): Promise<{ historyId: string; value: SettingValue<K> }> {
  const parsed = parseSetting(key, value);
  const [existing] = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  const now = nowIso();
  const historyId = newId();

  await db.batch([
    db
      .insert(settings)
      .values({ key, value: parsed, updatedAt: now, updatedBy: actorEmail })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: parsed, updatedAt: now, updatedBy: actorEmail },
      }),
    db.insert(settingsHistory).values({
      id: historyId,
      key,
      oldValue: existing?.value ?? null,
      newValue: parsed,
      changedBy: actorEmail,
      changedAt: now,
    }),
    auditInsert(db, {
      actorEmail,
      action,
      entity: "settings",
      entityId: key,
      before: existing?.value ?? null,
      after: parsed,
    }),
  ]);

  return { historyId, value: parsed };
}

/** Restores the value a history row changed TO. The restore itself becomes a new history row. */
export async function restoreSetting(
  db: Db,
  historyId: string,
  actorEmail: string,
): Promise<{ key: SettingKey; historyId: string }> {
  const [row] = await db
    .select()
    .from(settingsHistory)
    .where(eq(settingsHistory.id, historyId))
    .limit(1);
  if (!row) throw new Error(`History entry ${historyId} not found`);
  const key = row.key as SettingKey;
  const result = await saveSettingWithHistory(db, key, row.newValue, actorEmail, "restore");
  return { key, historyId: result.historyId };
}

/** Recent changes to a setting, newest first (for the "history / restore" panel). */
export async function listSettingHistory(db: Db, key: SettingKey, limit = 10) {
  return db
    .select({
      id: settingsHistory.id,
      changedBy: settingsHistory.changedBy,
      changedAt: settingsHistory.changedAt,
    })
    .from(settingsHistory)
    .where(eq(settingsHistory.key, key))
    .orderBy(desc(settingsHistory.changedAt), desc(settingsHistory.id))
    .limit(limit);
}
