import { describe, expect, it } from "vitest";
import { formatAuPhone } from "./business";

describe("formatAuPhone", () => {
  it("formats mobiles and landlines", () => {
    expect(formatAuPhone("+61412345678")).toBe("0412 345 678");
    expect(formatAuPhone("+61893331234")).toBe("(08) 9333 1234");
  });

  it("returns unknown formats unchanged", () => {
    expect(formatAuPhone("+6413001234")).toBe("+6413001234");
  });
});
