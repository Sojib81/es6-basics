/**
 * Weighted capacity per date + time window (BLUEPRINT 8 step 3, 10.2).
 * A job's units = its service's capacityWeight, doubled when bedrooms ≥ largeJobBedrooms.
 * Only CONFIRMED jobs count — requests don't block anyone.
 */
import { and, eq, gte, lte } from "drizzle-orm";
import type { Db } from "./db/client";
import { bookings } from "./db/schema";

export function capacityUnitsFor(
  serviceWeight: number,
  bedrooms: number | null | undefined,
  largeJobBedrooms: number,
): number {
  return serviceWeight * ((bedrooms ?? 0) >= largeJobBedrooms ? 2 : 1);
}

export const slotKey = (date: string, window: string) => `${date}|${window}`;

/** Units used per `date|window` among confirmed jobs between two Perth dates (inclusive). */
export async function getSlotLoads(db: Db, from: string, to: string): Promise<Map<string, number>> {
  const rows = await db
    .select({
      date: bookings.scheduledDate,
      window: bookings.scheduledWindow,
      units: bookings.capacityUnits,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.status, "confirmed"),
        gte(bookings.scheduledDate, from),
        lte(bookings.scheduledDate, to),
      ),
    );
  const loads = new Map<string, number>();
  for (const r of rows) {
    if (!r.date || !r.window) continue;
    const k = slotKey(r.date, r.window);
    loads.set(k, (loads.get(k) ?? 0) + (r.units ?? 1));
  }
  return loads;
}

/** Slots at or over capacity, as "date|window" keys. */
export function fullSlots(loads: Map<string, number>, maxPerWindow: number): string[] {
  return [...loads].filter(([, units]) => units >= maxPerWindow).map(([k]) => k);
}

/** Would adding `units` to this slot exceed the limit? (Owner must override in the admin.) */
export function wouldExceed(
  loads: Map<string, number>,
  date: string,
  window: string,
  units: number,
  maxPerWindow: number,
): boolean {
  return (loads.get(slotKey(date, window)) ?? 0) + units > maxPerWindow;
}
