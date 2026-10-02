import { describe, expect, it } from "vitest";
import { formatCents } from "./money";

describe("formatCents", () => {
  it.each([
    [42000, "$420"],
    [19950, "$199.50"],
    [5, "$0.05"],
    [123456789, "$1,234,567.89"],
    [-600, "−$6"],
    [0, "$0"],
  ])("%i → %s", (c, s) => expect(formatCents(c)).toBe(s));
});
