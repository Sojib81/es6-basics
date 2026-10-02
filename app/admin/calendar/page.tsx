import Link from "next/link";
import { Card } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth/admin";
import { addDays, weekdayOf } from "@/lib/booking-dates";
import { capacityUnitsFor } from "@/lib/capacity";
import { getSetting } from "@/lib/data/settings";
import { getDb } from "@/lib/db/client";
import { getJobs } from "@/lib/jobs";
import { formatIsoDate, SERVICE_LABELS } from "@/lib/notify/alerts";
import { perthDateString } from "@/lib/time";

const SERVICE_COLOUR: Record<string, string> = {
  vacate: "border-l-teal-600",
  preSale: "border-l-indigo-500",
  regular: "border-l-amber-500",
  carpetOnly: "border-l-purple-500",
  office: "border-l-slate-500",
};

export default async function CalendarPage(props: PageProps<"/admin/calendar">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const today = perthDateString(new Date());
  const pick =
    typeof sp.start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.start) ? sp.start : today;
  const monday = addDays(pick, -((weekdayOf(pick) + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const [jobs, booking] = await Promise.all([
    getJobs(await getDb(), days[0], days[6]),
    getSetting("booking"),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-ink text-xl font-bold">Week of {formatIsoDate(monday)}</h1>
        <div className="flex gap-2 text-sm">
          <Link
            href={`/admin/calendar?start=${addDays(monday, -7)}`}
            className="ring-line rounded-lg bg-white px-3 py-2 ring-1"
          >
            ← Prev
          </Link>
          <Link href="/admin/calendar" className="ring-line rounded-lg bg-white px-3 py-2 ring-1">
            This week
          </Link>
          <Link
            href={`/admin/calendar?start=${addDays(monday, 7)}`}
            className="ring-line rounded-lg bg-white px-3 py-2 ring-1"
          >
            Next →
          </Link>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-7">
        {days.map((d) => {
          const blocked = booking.blockedDates.includes(d);
          return (
            <Card
              key={d}
              className={`${d === today ? "ring-brand ring-2" : ""} ${blocked ? "bg-surface" : ""}`}
            >
              <p className="text-ink mb-2 font-semibold">
                {formatIsoDate(d)}
                {blocked && <span className="ml-2 text-xs font-normal text-red-700">blocked</span>}
              </p>
              <div className="space-y-3">
                {booking.timeWindows.map((w) => {
                  const inSlot = jobs.filter(
                    (j) => j.scheduledDate === d && j.scheduledWindow === w.id,
                  );
                  const used = inSlot.reduce(
                    (n, j) =>
                      n +
                      (j.capacityUnits ??
                        capacityUnitsFor(1, j.bedrooms, booking.largeJobBedrooms)),
                    0,
                  );
                  const pct = Math.min(100, Math.round((used / booking.maxJobsPerWindow) * 100));
                  return (
                    <div key={w.id}>
                      <div className="text-muted flex items-center justify-between text-xs">
                        <span>{w.label.split(" (")[0]}</span>
                        <span
                          className={
                            used >= booking.maxJobsPerWindow ? "font-semibold text-red-700" : ""
                          }
                        >
                          {used}/{booking.maxJobsPerWindow}
                        </span>
                      </div>
                      <div className="bg-line mt-1 h-1.5 rounded-full" aria-hidden>
                        <div
                          className={`h-1.5 rounded-full ${used >= booking.maxJobsPerWindow ? "bg-red-600" : "bg-brand"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <ul className="mt-1 space-y-1">
                        {inSlot.map((j) => (
                          <li key={j.id}>
                            <Link
                              href={`/admin/leads/${j.ref}`}
                              className={`ring-line block rounded border-l-4 bg-white p-1.5 text-xs ring-1 ${SERVICE_COLOUR[j.service] ?? ""} ${j.status === "completed" ? "opacity-60" : ""}`}
                            >
                              <span className="font-semibold">{j.suburb}</span> ·{" "}
                              {SERVICE_LABELS[j.service]}
                              {j.bedrooms ? ` ${j.bedrooms}×${j.bathrooms}` : ""}
                              {j.assignees.length > 0 && (
                                <span className="text-muted block">
                                  {j.assignees.map((a) => a.split("@")[0]).join(", ")}
                                </span>
                              )}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
