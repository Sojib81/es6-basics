/**
 * Which dates can be requested (BLUEPRINT 8 step 3). All dates are Perth calendar dates (YYYY-MM-DD).
 */
import type { BookingSettings } from "./schemas/settings";
import { parseHhMm, perthDateString, perthParts } from "./time";

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekdayOf(isoDate: string): number {
  return new Date(`${isoDate}T00:00:00Z`).getUTCDay(); // 0 = Sunday
}

/** First requestable date: today + minDaysAhead; same-day only before the cut-off. */
export function earliestBookableDate(
  now: Date,
  s: Pick<BookingSettings, "minDaysAhead" | "sameDayCutoff">,
): string {
  const today = perthDateString(now);
  if (s.minDaysAhead > 0) return addDays(today, s.minDaysAhead);
  const p = perthParts(now);
  return p.hour * 60 + p.minute < parseHhMm(s.sameDayCutoff) ? today : addDays(today, 1);
}

export const MAX_DAYS_AHEAD = 90;

export function isBookableDate(
  isoDate: string,
  now: Date,
  s: Pick<BookingSettings, "minDaysAhead" | "sameDayCutoff" | "blockedDates">,
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return false;
  const earliest = earliestBookableDate(now, s);
  const latest = addDays(perthDateString(now), MAX_DAYS_AHEAD);
  return isoDate >= earliest && isoDate <= latest && !s.blockedDates.includes(isoDate);
}
