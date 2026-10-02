/** Shared handler for admin CSV downloads: admin-only, validated date range (max 2 years). */
import { getAdmin } from "@/lib/auth/admin";
import { addDays } from "./booking-dates";
import { getDb } from "./db/client";
import { perthDateString } from "./time";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export async function csvDownload(
  request: Request,
  name: string,
  build: (db: Awaited<ReturnType<typeof getDb>>, from: string, to: string) => Promise<string>,
) {
  if (!(await getAdmin())) return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  const today = perthDateString(new Date());
  const to = ISO.test(url.searchParams.get("to") ?? "") ? url.searchParams.get("to")! : today;
  const from = ISO.test(url.searchParams.get("from") ?? "")
    ? url.searchParams.get("from")!
    : addDays(to, -30);
  if (from > to || from < addDays(to, -731)) return new Response("Bad date range", { status: 400 });
  const csv = await build(await getDb(), from, to);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}-${from}-to-${to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
