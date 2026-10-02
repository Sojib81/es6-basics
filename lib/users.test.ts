import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { adminUsers, auditLog } from "./db/schema";
import { createTestDb, type TestDb } from "./db/test-db";
import { listAdminUsers, saveAdminUser, setAdminActive } from "./users";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.dispose());
beforeEach(async () => {
  await t.reset();
  await t.db
    .insert(adminUsers)
    .values({ email: "owner@x.com", name: "Owner", role: "owner", active: true });
});

describe("admin users", () => {
  it("adds and edits users, normalising email and phone, with audit", async () => {
    expect(
      await saveAdminUser(
        t.db,
        { email: " Partner@X.com ", name: "Partner", smsPhone: "0412 345 678" },
        "owner@x.com",
      ),
    ).toEqual({ ok: true });
    const p = (await listAdminUsers(t.db)).find((u) => u.email === "partner@x.com")!;
    expect(p).toMatchObject({ smsPhone: "+61412345678", active: true, role: "owner" });
    expect(
      await saveAdminUser(
        t.db,
        { email: "partner@x.com", name: "Partner 2", smsPhone: "" },
        "owner@x.com",
      ),
    ).toEqual({ ok: true });
    expect(
      (await listAdminUsers(t.db)).find((u) => u.email === "partner@x.com")!.smsPhone,
    ).toBeNull();
    expect((await t.db.select().from(auditLog)).map((a) => a.action)).toEqual(["create", "update"]);
  });

  it("rejects bad phones and emails", async () => {
    expect(
      await saveAdminUser(t.db, { email: "x@x.com", name: "X", smsPhone: "123" }, "owner@x.com"),
    ).toMatchObject({ ok: false });
    expect(await saveAdminUser(t.db, { email: "nope", name: "X" }, "owner@x.com")).toMatchObject({
      ok: false,
    });
  });

  it("never leaves the business without an active owner, and you can't lock yourself out", async () => {
    expect(await setAdminActive(t.db, "owner@x.com", false, "owner@x.com")).toMatchObject({
      ok: false,
    });
    await saveAdminUser(t.db, { email: "p@x.com", name: "P" }, "owner@x.com");
    expect(await setAdminActive(t.db, "owner@x.com", false, "p@x.com")).toEqual({ ok: true });
    expect(await setAdminActive(t.db, "p@x.com", false, "someone@x.com")).toMatchObject({
      ok: false,
    }); // last active owner
    expect(
      await saveAdminUser(t.db, { email: "p@x.com", name: "P", role: "staff" }, "other@x.com"),
    ).toMatchObject({ ok: false });
    expect(await setAdminActive(t.db, "owner@x.com", true, "p@x.com")).toEqual({ ok: true });
  });
});
