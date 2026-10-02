import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  currentSettingVersionId,
  readSetting,
  restoreSetting,
  saveSettingWithHistory,
  SettingMissingError,
  writeAudit,
} from "./audit";
import { auditLog, settingsHistory } from "./db/schema";
import { createTestDb, type TestDb } from "./db/test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.dispose());
beforeEach(async () => {
  await t.reset();
  await t.seed();
});

describe("readSetting", () => {
  it("returns validated settings", async () => {
    const pricing = await readSetting(t.db, "pricing");
    expect(pricing.currency).toBe("AUD");
  });

  it("throws a helpful error when a setting is missing", async () => {
    await t.reset();
    await expect(readSetting(t.db, "business")).rejects.toBeInstanceOf(SettingMissingError);
  });
});

describe("saveSettingWithHistory", () => {
  it("saves, records history and audits in one go", async () => {
    const home = await readSetting(t.db, "home");
    const { historyId } = await saveSettingWithHistory(
      t.db,
      "home",
      { ...home, heroHeadline: "New headline" },
      "owner@example.com",
    );

    expect((await readSetting(t.db, "home")).heroHeadline).toBe("New headline");
    const [h] = await t.db.select().from(settingsHistory).where(eq(settingsHistory.id, historyId));
    expect(h.changedBy).toBe("owner@example.com");
    expect((h.oldValue as { heroHeadline: string }).heroHeadline).toBe(home.heroHeadline);
    expect(await currentSettingVersionId(t.db, "home")).toBe(historyId);

    const audits = await t.db.select().from(auditLog).where(eq(auditLog.entityId, "home"));
    expect(audits).toHaveLength(1);
    expect(audits[0].action).toBe("update");
  });

  it("rejects invalid values and changes nothing", async () => {
    await expect(
      saveSettingWithHistory(t.db, "booking", { depositEnabled: "yes" }, "owner@example.com"),
    ).rejects.toThrow();
    expect(await t.db.select().from(auditLog)).toHaveLength(0);
  });

  it("restores a previous version as a new history entry", async () => {
    const original = await readSetting(t.db, "home");
    const seedVersion = await currentSettingVersionId(t.db, "home");
    await saveSettingWithHistory(t.db, "home", { ...original, heroHeadline: "Changed" }, "a@x.com");

    const restored = await restoreSetting(t.db, seedVersion!, "b@x.com");
    expect(restored.key).toBe("home");
    expect((await readSetting(t.db, "home")).heroHeadline).toBe(original.heroHeadline);
    const audits = await t.db.select().from(auditLog);
    expect(audits.map((a) => a.action).sort()).toEqual(["restore", "update"]);
  });
});

describe("writeAudit", () => {
  it("stores before/after JSON", async () => {
    await writeAudit(t.db, {
      actorEmail: "a@x.com",
      action: "status_change",
      entity: "booking",
      entityId: "b1",
      before: { status: "new" },
      after: { status: "contacted" },
    });
    const [row] = await t.db.select().from(auditLog);
    expect(row.after).toEqual({ status: "contacted" });
  });
});
