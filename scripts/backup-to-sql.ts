/**
 * Turns a weekly backup file into SQL you can load into a FRESH database.
 *   npx wrangler r2 object get cleaning-site-media/backups/2026-10-11.json.gz --file backup.json.gz --remote
 *   npx tsx scripts/backup-to-sql.ts backup.json.gz > restore.sql
 *   (create a new D1, apply migrations, then)  npx wrangler d1 execute <NEW_DB> --remote --file restore.sql
 */
import { readFileSync } from "node:fs";
import { backupToSql, gunzipJson, type BackupFile } from "../lib/cron/backup";

const file = process.argv[2];
if (!file) {
  console.error("Usage: tsx scripts/backup-to-sql.ts <backup.json.gz>");
  process.exit(1);
}
void gunzipJson<BackupFile>(new Uint8Array(readFileSync(file))).then((backup) => {
  process.stdout.write(backupToSql(backup).join("\n") + "\n");
});
