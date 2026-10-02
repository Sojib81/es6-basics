import { describe, expect, it } from "vitest";
import {
  type BusinessHours,
  formatPerth,
  isInQuietHours,
  isWithinBusinessHours,
  parseHhMm,
  perthDateString,
  perthParts,
} from "./time";

const hours: BusinessHours = {
  mon: { open: "07:00", close: "18:00" },
  tue: { open: "07:00", close: "18:00" },
  wed: { open: "07:00", close: "18:00" },
  thu: { open: "07:00", close: "18:00" },
  fri: { open: "07:00", close: "18:00" },
  sat: { open: "08:00", close: "14:00" },
  sun: null,
};

describe("perthParts / perthDateString", () => {
  it("is UTC+8 with no daylight saving", () => {
    // 2026-01-15 (southern summer) and 2026-07-15 (winter) both +8
    expect(perthParts(new Date("2026-01-15T00:00:00Z")).hour).toBe(8);
    expect(perthParts(new Date("2026-07-15T00:00:00Z")).hour).toBe(8);
  });

  it("rolls the date over at UTC 16:00", () => {
    expect(perthDateString(new Date("2026-10-01T15:59:00Z"))).toBe("2026-10-01");
    expect(perthDateString(new Date("2026-10-01T16:00:00Z"))).toBe("2026-10-02");
  });

  it("reports the Perth weekday", () => {
    // 2026-10-04T18:00Z is Mon 5 Oct 02:00 in Perth
    expect(perthParts(new Date("2026-10-04T18:00:00Z")).weekday).toBe("mon");
  });
});

describe("parseHhMm", () => {
  it("parses valid times and rejects invalid ones", () => {
    expect(parseHhMm("00:00")).toBe(0);
    expect(parseHhMm("06:30")).toBe(390);
    expect(parseHhMm("23:59")).toBe(1439);
    expect(() => parseHhMm("24:00")).toThrow();
    expect(() => parseHhMm("7:00")).toThrow();
  });
});

describe("isWithinBusinessHours", () => {
  it("uses Perth time, open inclusive and close exclusive", () => {
    // Mon 5 Oct 2026, Perth 07:00 = 2026-10-04T23:00Z
    expect(isWithinBusinessHours(new Date("2026-10-04T23:00:00Z"), hours)).toBe(true);
    // Perth 06:59
    expect(isWithinBusinessHours(new Date("2026-10-04T22:59:00Z"), hours)).toBe(false);
    // Perth 18:00 (close)
    expect(isWithinBusinessHours(new Date("2026-10-05T10:00:00Z"), hours)).toBe(false);
  });

  it("is closed on days set to null", () => {
    // Sun 4 Oct 2026, Perth 12:00 = 04:00Z
    expect(isWithinBusinessHours(new Date("2026-10-04T04:00:00Z"), hours)).toBe(false);
  });
});

describe("isInQuietHours", () => {
  const quiet = { start: "21:00", end: "06:30" };

  it("handles windows that cross midnight", () => {
    expect(isInQuietHours(new Date("2026-10-05T13:00:00Z"), quiet)).toBe(true); // 21:00 Perth
    expect(isInQuietHours(new Date("2026-10-05T18:00:00Z"), quiet)).toBe(true); // 02:00 Perth
    expect(isInQuietHours(new Date("2026-10-05T22:29:00Z"), quiet)).toBe(true); // 06:29 Perth
    expect(isInQuietHours(new Date("2026-10-05T22:30:00Z"), quiet)).toBe(false); // 06:30 Perth
    expect(isInQuietHours(new Date("2026-10-05T04:00:00Z"), quiet)).toBe(false); // 12:00 Perth
  });

  it("handles same-day windows and disabled quiet hours", () => {
    expect(isInQuietHours(new Date("2026-10-05T05:00:00Z"), { start: "12:00", end: "14:00" })).toBe(
      true,
    );
    expect(isInQuietHours(new Date("2026-10-05T05:00:00Z"), { start: "00:00", end: "00:00" })).toBe(
      false,
    );
  });
});

describe("formatPerth", () => {
  it("formats in Perth time", () => {
    expect(formatPerth(new Date("2026-10-13T01:30:00Z"))).toMatch(/Tue.*13.*Oct.*9:30/);
  });
});
