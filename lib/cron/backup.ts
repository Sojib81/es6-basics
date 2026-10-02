/**
 * Weekly backup (BLUEPRINT 9): every table → one gzipped JSON file in R2 under backups/ (MEDIA bucket;
 * the /media route only serves files listed in the media table, so backups are never public).
 * Access notes are blanked (privacy). Keeps the newest 8. D1 Time Travel (30 days) is the first line
 * of recovery; these files are the long-term fallback. Restore: scripts/backup-to-sql.ts.
 */
const SKIP_TABLES = new Set(["rate_counters", "d1_migrations"]);
export const BACKUP_PREFIX = "backups/";
export const BACKUPS_KEPT = 8;

export async function gzipJson(data: unknown): Promise<Uint8Array> {
  const stream = new Blob([JSON.stringify(data)])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function gunzipJson<T>(bytes: Uint8Array): Promise<T> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(stream).text()) as T;
}

export type BackupFile = { createdAt: string; tables: Record<string, Record<string, unknown>[]> };

export async function weeklyBackup(
  d1: D1Database,
  bucket: R2Bucket,
  now: Date = new Date(),
): Promise<string> {
  const { results } = await d1
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name",
    )
    .all<{ name: string }>();
  const tables: BackupFile["tables"] = {};
  for (const { name } of results) {
    if (SKIP_TABLES.has(name)) continue;
    const rows = (await d1.prepare(`SELECT * FROM "${name}"`).all<Record<string, unknown>>())
      .results;
    tables[name] = name === "bookings" ? rows.map((r) => ({ ...r, access_notes: null })) : rows;
  }
  const key = `${BACKUP_PREFIX}${now.toISOString().slice(0, 10)}.json.gz`;
  const body = await gzipJson({ createdAt: now.toISOString(), tables } satisfies BackupFile);
  await bucket.put(key, body, { httpMetadata: { contentType: "application/gzip" } });

  const listed = await bucket.list({ prefix: BACKUP_PREFIX });
  const old = listed.objects
    .map((o) => o.key)
    .sort()
    .reverse()
    .slice(BACKUPS_KEPT);
  if (old.length) await bucket.delete(old);
  const rowCount = Object.values(tables).reduce((n, r) => n + r.length, 0);
  return `backup: ${key} (${Object.keys(tables).length} tables, ${rowCount} rows, ${body.length} bytes), removed ${old.length} old`;
}

const sqlValue = (v: unknown): string =>
  v === null || v === undefined
    ? "NULL"
    : typeof v === "number"
      ? String(v)
      : `'${String(v).replaceAll("'", "''")}'`;

/**
 * SQL statements that load a backup into a database that already has the schema (migrations).
 * INSERT OR REPLACE, so it can also top up a database restored with D1 Time Travel.
 * Statements may contain newlines (templates) — join with "\n", never split by line.
 */
export function backupToSql(backup: BackupFile): string[] {
  const out = [
    `-- Restored from backup taken ${backup.createdAt}`,
    "PRAGMA defer_foreign_keys = true;",
  ];
  for (const [table, rows] of Object.entries(backup.tables))
    for (const row of rows) {
      const cols = Object.keys(row);
      out.push(
        `INSERT OR REPLACE INTO "${table}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${cols.map((c) => sqlValue(row[c])).join(", ")});`,
      );
    }
  return out;
}
