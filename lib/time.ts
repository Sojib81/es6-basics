/**
 * Perth time helpers. All business times are Australia/Perth (UTC+8, no daylight saving).
 * Timestamps are stored as UTC ISO strings; convert only for display and business rules.
 * Cron expressions are UTC — Perth 02:00 is `0 18 * * *` (previous UTC day).
 */
export const PERTH_TZ = "Australia/Perth";

export const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export type PerthParts = {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number;
  weekday: Weekday;
};

const partsFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: PERTH_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  weekday: "short",
  hourCycle: "h23",
});

export function perthParts(date: Date): PerthParts {
  const map: Record<string, string> = {};
  for (const p of partsFormatter.formatToParts(date)) map[p.type] = p.value;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    weekday: map.weekday.toLowerCase().slice(0, 3) as Weekday,
  };
}

export function nowInPerth(now: Date = new Date()): PerthParts {
  return perthParts(now);
}

/** Perth calendar date as `YYYY-MM-DD` (used for daily rate-limit keys, booking dates). */
export function perthDateString(date: Date): string {
  const { year, month, day } = perthParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** "HH:MM" → minutes since midnight. Throws on malformed input. */
export function parseHhMm(value: string): number {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!m) throw new Error(`Invalid time "${value}", expected HH:MM`);
  return Number(m[1]) * 60 + Number(m[2]);
}

export type OpeningHours = { open: string; close: string } | null;
/** Per-weekday opening hours in Perth time; `null` = closed that day. */
export type BusinessHours = Record<Weekday, OpeningHours>;

/** True if `date` falls within that Perth weekday's [open, close) window. */
export function isWithinBusinessHours(date: Date, hours: BusinessHours): boolean {
  const p = perthParts(date);
  const today = hours[p.weekday];
  if (!today) return false;
  const minutes = p.hour * 60 + p.minute;
  return minutes >= parseHhMm(today.open) && minutes < parseHhMm(today.close);
}

/**
 * Quiet hours (no SMS), e.g. { start: "21:00", end: "06:30" }. Handles windows that cross
 * midnight. start === end means quiet hours are disabled.
 */
export function isInQuietHours(date: Date, quiet: { start: string; end: string }): boolean {
  const start = parseHhMm(quiet.start);
  const end = parseHhMm(quiet.end);
  if (start === end) return false;
  const p = perthParts(date);
  const minutes = p.hour * 60 + p.minute;
  return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

/** Human-friendly Perth date/time for the UI and messages, e.g. "Tue 14 Oct, 9:30 am". */
export function formatPerth(date: Date, options: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: PERTH_TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    ...options,
  }).format(date);
}
