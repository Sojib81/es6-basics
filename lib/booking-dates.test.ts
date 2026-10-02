import { describe, expect, it } from "vitest";
import { addDays, earliestBookableDate, isBookableDate } from "./booking-dates";

// 2026-10-05 is a Monday. 01:00Z = 09:00 Perth; 05:00Z = 13:00 Perth.
const morning = new Date("2026-10-05T01:00:00Z");
const afternoon = new Date("2026-10-05T05:00:00Z");
const base = { minDaysAhead: 0, sameDayCutoff: "12:00", blockedDates: [] as string[] };

describe("booking dates", () => {
  it("addDays crosses months and years", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("same-day allowed only before the cut-off (Perth time)", () => {
    expect(earliestBookableDate(morning, base)).toBe("2026-10-05");
    expect(earliestBookableDate(afternoon, base)).toBe("2026-10-06");
  });

  it("minDaysAhead pushes the earliest date", () => {
    expect(earliestBookableDate(morning, { ...base, minDaysAhead: 2 })).toBe("2026-10-07");
  });

  it("uses the Perth date, not UTC", () => {
    // 2026-10-05T17:00Z is already Tue 6 Oct 01:00 in Perth
    expect(
      earliestBookableDate(new Date("2026-10-05T17:00:00Z"), { ...base, minDaysAhead: 1 }),
    ).toBe("2026-10-07");
  });

  it("rejects blocked, past, too-far and malformed dates", () => {
    const s = { ...base, minDaysAhead: 1, blockedDates: ["2026-10-08"] };
    expect(isBookableDate("2026-10-06", morning, s)).toBe(true);
    expect(isBookableDate("2026-10-05", morning, s)).toBe(false);
    expect(isBookableDate("2026-10-08", morning, s)).toBe(false);
    expect(isBookableDate(addDays("2026-10-05", 91), morning, s)).toBe(false);
    expect(isBookableDate("06/10/2026", morning, s)).toBe(false);
  });
});
