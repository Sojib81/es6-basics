import { describe, expect, it } from "vitest";
import { generateRef, isRef, REF_ALPHABET, withUniqueRef } from "./refs";

describe("generateRef", () => {
  it("has the prefix, 6 chars and no ambiguous characters", () => {
    for (let i = 0; i < 500; i++) {
      const ref = generateRef("BK");
      expect(ref).toMatch(/^BK-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
      expect(isRef(ref, "BK")).toBe(true);
    }
    expect(REF_ALPHABET).not.toMatch(/[01OIL]/);
  });

  it("rejects malformed refs", () => {
    expect(isRef("BK-ABC")).toBe(false);
    expect(isRef("BK-ABCDE0")).toBe(false);
    expect(isRef("EQ-ABCDEF", "BK")).toBe(false);
  });
});

describe("withUniqueRef", () => {
  const collision = new Error(
    "D1_ERROR: UNIQUE constraint failed: bookings.ref: SQLITE_CONSTRAINT",
  );

  it("retries on ref collisions", async () => {
    let calls = 0;
    const ref = await withUniqueRef("BK", async (r) => {
      calls++;
      if (calls < 3) throw collision;
      return r;
    });
    expect(calls).toBe(3);
    expect(isRef(ref, "BK")).toBe(true);
  });

  it("gives up after 5 attempts and rethrows other errors at once", async () => {
    let calls = 0;
    await expect(
      withUniqueRef("BK", async () => {
        calls++;
        throw collision;
      }),
    ).rejects.toThrow(/UNIQUE/);
    expect(calls).toBe(5);

    calls = 0;
    await expect(
      withUniqueRef("BK", async () => {
        calls++;
        throw new Error("UNIQUE constraint failed: customers.phone");
      }),
    ).rejects.toThrow();
    expect(calls).toBe(1);
  });
});
