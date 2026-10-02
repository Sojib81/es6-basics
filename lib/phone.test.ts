import { describe, expect, it } from "vitest";
import { formatAuPhone, isAuMobile, normalizeAuPhone } from "./phone";

describe("normalizeAuPhone", () => {
  it.each([
    ["0412 345 678", "+61412345678"],
    ["0412-345-678", "+61412345678"],
    ["+61 412 345 678", "+61412345678"],
    ["61412345678", "+61412345678"],
    ["0061412345678", "+61412345678"],
    ["+61 (0)412 345 678", "+61412345678"],
    ["(08) 9333 1234", "+61893331234"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeAuPhone(input)).toBe(expected);
  });

  it.each(["", "12345", "0512 345 678", "+1 415 555 0100", "04123456789", "abc"])(
    "rejects %s",
    (input) => {
      expect(normalizeAuPhone(input)).toBeNull();
    },
  );
});

describe("isAuMobile / formatAuPhone", () => {
  it("detects mobiles", () => {
    expect(isAuMobile("+61412345678")).toBe(true);
    expect(isAuMobile("+61893331234")).toBe(false);
  });

  it("formats mobiles and landlines, leaves others alone", () => {
    expect(formatAuPhone("+61412345678")).toBe("0412 345 678");
    expect(formatAuPhone("+61893331234")).toBe("(08) 9333 1234");
    expect(formatAuPhone("+6413001234")).toBe("+6413001234");
  });
});
