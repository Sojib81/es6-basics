import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bookings, customers } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/lib/db/test-db";
import { BACKUP_PREFIX, backupToSql, gunzipJson, weeklyBackup, type BackupFile } from "./backup";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.dispose());
beforeEach(async () => {
  await t.reset();
  await t.seed();
  const listed = await t.media.list({ prefix: BACKUP_PREFIX });
  if (listed.objects.length) await t.media.delete(listed.objects.map((o) => o.key));
  await t.db.insert(customers).values({ id: "c", name: "Jane", phone: "+61412345678" });
  await t.db.insert(bookings).values({
    id: "b",
    ref: "BK-222222",
    bookerCustomerId: "c",
    submittedName: "Jane",
    bookerRole: "tenant",
    service: "vacate",
    accessNotes: "Lockbox 4821",
  });
});

describe("weeklyBackup", () => {
  it("writes every table to gzipped JSON in R2, without access notes", async () => {
    const summary = await weeklyBackup(t.d1, t.media, new Date("2026-10-10T19:00:00Z"));
    expect(summary).toMatch(/^backup: backups\/2026-10-10\.json\.gz/);
    const obj = await t.media.get("backups/2026-10-10.json.gz");
    const data = await gunzipJson<BackupFile>(new Uint8Array(await obj!.arrayBuffer()));
    expect(Object.keys(data.tables)).toEqual(
      expect.arrayContaining(["bookings", "customers", "settings", "invoices", "audit_log"]),
    );
    expect(data.tables).not.toHaveProperty("rate_counters");
    expect(data.tables.bookings[0]).toMatchObject({ ref: "BK-222222", access_notes: null });
    expect(data.tables.settings.length).toBeGreaterThan(5);
  });

  it("keeps only the newest 8", async () => {
    for (let i = 0; i < 10; i++)
      await weeklyBackup(t.d1, t.media, new Date(Date.UTC(2026, 0, 1 + i * 7, 19)));
    const keys = (await t.media.list({ prefix: BACKUP_PREFIX })).objects.map((o) => o.key).sort();
    expect(keys).toHaveLength(8);
    expect(keys[0]).toBe("backups/2026-01-15.json.gz");
  });

  it("restores into a fresh database with the same rows (backup → SQL → D1)", async () => {
    await weeklyBackup(t.d1, t.media, new Date("2026-10-10T19:00:00Z"));
    const obj = await t.media.get("backups/2026-10-10.json.gz");
    const backup = await gunzipJson<BackupFile>(new Uint8Array(await obj!.arrayBuffer()));

    await t.reset(); // empty schema, like a new D1 with migrations applied
    const statements = backupToSql(backup).filter((s) => !s.startsWith("--"));
    await t.d1.batch(statements.map((s) => t.d1.prepare(s)));

    for (const [table, rows] of Object.entries(backup.tables)) {
      const r = await t.d1.prepare(`SELECT count(*) AS n FROM "${table}"`).first<{ n: number }>();
      expect(r?.n, table).toBe(rows.length);
    }
    const tpl = await t.d1
      .prepare("SELECT body FROM message_templates WHERE body LIKE '%' || char(10) || '%' LIMIT 1")
      .first<{ body: string }>();
    expect(tpl?.body).toContain("\n"); // multi-line text survives
  });
});
