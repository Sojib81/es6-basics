import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { customers } from "./db/schema";
import { createTestDb, type TestDb } from "./db/test-db";
import { detailsDiffer, matchOrCreateCustomer } from "./customers";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.dispose());
beforeEach(async () => t.reset());

const jane = { phone: "+61412345678", name: "Jane Citizen", email: "jane@example.com" };

describe("matchOrCreateCustomer", () => {
  it("creates a customer for a new phone", async () => {
    const r = await matchOrCreateCustomer(t.db, jane);
    expect(r.created).toBe(true);
    const rows = await t.db.select().from(customers);
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe("jane@example.com");
  });

  it("links to the existing customer and never overwrites their details", async () => {
    const first = await matchOrCreateCustomer(t.db, jane);
    const second = await matchOrCreateCustomer(t.db, {
      phone: jane.phone,
      name: "Someone Else",
      email: "attacker@example.com",
    });
    expect(second.customerId).toBe(first.customerId);
    expect(second.created).toBe(false);
    expect(second.detailsDiffer).toBe(true);
    const [row] = await t.db.select().from(customers);
    expect(row.name).toBe("Jane Citizen");
    expect(row.email).toBe("jane@example.com");
  });

  it("does not flag differences for the same person", async () => {
    await matchOrCreateCustomer(t.db, jane);
    const again = await matchOrCreateCustomer(t.db, { ...jane, name: "  jane   citizen " });
    expect(again.detailsDiffer).toBe(false);
  });

  it("handles concurrent submissions with the same phone", async () => {
    const results = await Promise.all([1, 2, 3].map(() => matchOrCreateCustomer(t.db, jane)));
    expect(new Set(results.map((r) => r.customerId)).size).toBe(1);
    expect(await t.db.select().from(customers)).toHaveLength(1);
  });

  it("refuses un-normalised phones", async () => {
    await expect(matchOrCreateCustomer(t.db, { ...jane, phone: "0412 345 678" })).rejects.toThrow();
  });
});

describe("detailsDiffer", () => {
  it("ignores a missing email on either side", () => {
    expect(detailsDiffer({ name: "A", email: null }, { name: "a", email: "x@y.com" })).toBe(false);
    expect(detailsDiffer({ name: "A", email: "x@y.com" }, { name: "A" })).toBe(false);
    expect(detailsDiffer({ name: "A", email: "x@y.com" }, { name: "A", email: "z@y.com" })).toBe(
      true,
    );
  });
});
