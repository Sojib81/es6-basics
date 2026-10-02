import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { adminUsers, settings, settingsHistory } from "./schema";
import { buildSeedSql, sqlString } from "./seed-sql";
import { createTestDb, readSeedFiles, type TestDb } from "./test-db";
import { SETTING_KEYS } from "@/lib/schemas/settings";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.dispose());
beforeEach(async () => t.reset());

describe("sqlString", () => {
  it("escapes quotes and handles null", () => {
    expect(sqlString("Perth's")).toBe("'Perth''s'");
    expect(sqlString(null)).toBe("NULL");
  });
});

describe("seed", () => {
  it("validates seed files against the settings schemas", () => {
    const input = readSeedFiles();
    expect(() => buildSeedSql(input)).not.toThrow();
    const broken = { ...input, settings: { ...input.settings, pricing: { currency: "USD" } } };
    expect(() => buildSeedSql(broken)).toThrow();
  });

  it("fills every setting key, with a history row for each", async () => {
    await t.seed();
    const rows = await t.db.select().from(settings);
    expect(rows.map((r) => r.key).sort()).toEqual([...SETTING_KEYS].sort());
    const history = await t.db.select().from(settingsHistory);
    expect(history).toHaveLength(SETTING_KEYS.length);
    expect(history.every((h) => h.changedBy === "seed")).toBe(true);
    expect((await t.db.select().from(adminUsers)).length).toBeGreaterThan(0);
  });

  it("never overwrites existing rows when re-run", async () => {
    await t.seed();
    await t.db
      .update(settings)
      .set({ value: { changed: true }, updatedBy: "owner@example.com" })
      .where(eq(settings.key, "home"));
    await t.seed();
    const [home] = await t.db.select().from(settings).where(eq(settings.key, "home"));
    expect(home.value).toEqual({ changed: true });
    expect(await t.db.select().from(settingsHistory)).toHaveLength(SETTING_KEYS.length);
  });
});
