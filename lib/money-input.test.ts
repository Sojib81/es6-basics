import { describe, expect, it } from "vitest";
import {
  bpToMultiplier,
  bpToPercent,
  centsToDollars,
  dollarsToCents,
  multiplierToBp,
  percentToBp,
} from "./money-input";

describe("money input", () => {
  it.each([
    ["420", 42000],
    ["$420.5", 42050],
    ["420.05", 42005],
    ["1,250.00", 125000],
    ["0.1", 10],
    [" 57 ", 5700],
  ])("dollars %s → %i cents", (s, c) => expect(dollarsToCents(s)).toBe(c));

  it.each(["", "abc", "4.205", "-5", "1e3", "12.3.4"])("rejects %s", (s) =>
    expect(dollarsToCents(s)).toBeNull(),
  );

  it("is exact where floats are not (0.29 × 100 = 28.999…)", () => {
    expect(dollarsToCents("0.29")).toBe(29);
    expect(dollarsToCents("19.99")).toBe(1999);
  });

  it("round-trips", () => {
    for (const c of [0, 5, 42000, 42050, 19999]) expect(dollarsToCents(centsToDollars(c))).toBe(c);
    for (const bp of [10000, 12000, 9500, 12345, 10001])
      expect(multiplierToBp(bpToMultiplier(bp))).toBe(bp);
    for (const bp of [500, 550, 5, 10000]) expect(percentToBp(bpToPercent(bp))).toBe(bp);
  });

  it("multipliers and percents", () => {
    expect(multiplierToBp("1.2")).toBe(12000);
    expect(multiplierToBp("×0.95")).toBe(9500);
    expect(bpToMultiplier(12000)).toBe("1.2");
    expect(percentToBp("5%")).toBe(500);
    expect(percentToBp("7.5")).toBe(750);
  });
});
