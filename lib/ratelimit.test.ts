import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./db/test-db";
import { checkBurst, checkDailyCaps, DAILY_LIMITS } from "./ratelimit";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.dispose());
beforeEach(async () => t.reset());

const now = new Date("2026-10-05T01:00:00Z");

describe("checkDailyCaps", () => {
  it("allows up to the per-phone limit, then blocks", async () => {
    const ids = { phone: "+61412345678" };
    for (let i = 0; i < DAILY_LIMITS.booking.perPhone; i++)
      expect((await checkDailyCaps(t.db, "booking", ids, now)).allowed).toBe(true);
    expect(await checkDailyCaps(t.db, "booking", ids, now)).toEqual({
      allowed: false,
      reason: "phone",
    });
  });

  it("resets on the next Perth day and is separate per form kind", async () => {
    const ids = { phone: "+61412345678" };
    for (let i = 0; i <= DAILY_LIMITS.booking.perPhone; i++)
      await checkDailyCaps(t.db, "booking", ids, now);
    expect((await checkDailyCaps(t.db, "enquiry", ids, now)).allowed).toBe(true);
    const tomorrow = new Date("2026-10-05T16:00:00Z"); // Perth midnight
    expect((await checkDailyCaps(t.db, "booking", ids, tomorrow)).allowed).toBe(true);
  });

  it("caps per IP across different phones", async () => {
    for (let i = 0; i < DAILY_LIMITS.booking.perIp; i++)
      await checkDailyCaps(
        t.db,
        "booking",
        { ip: "1.1.1.1", phone: `+614123456${String(i).padStart(2, "0")}` },
        now,
      );
    expect(
      await checkDailyCaps(t.db, "booking", { ip: "1.1.1.1", phone: "+61499999999" }, now),
    ).toEqual({
      allowed: false,
      reason: "ip",
    });
  });
});

describe("checkBurst", () => {
  it("uses the binding and fails open if it errors or is missing", async () => {
    expect(await checkBurst(undefined, "k")).toBe(true);
    expect(await checkBurst({ limit: async () => ({ success: false }) } as RateLimit, "k")).toBe(
      false,
    );
    expect(
      await checkBurst(
        {
          limit: async () => {
            throw new Error("x");
          },
        } as unknown as RateLimit,
        "k",
      ),
    ).toBe(true);
  });
});
