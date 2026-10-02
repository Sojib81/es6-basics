/**
 * Runs one scheduled job. Called by the Worker's scheduled() handler (worker.ts) with the
 * CRON_SECRET header — never public. Unknown job or bad secret → 404.
 */
import { getServerEnv } from "@/lib/config";
import { JOB_HANDLERS } from "@/lib/cron/jobs";
import { createDb } from "@/lib/db/client";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(request: Request, ctx: RouteContext<"/api/cron/[job]">) {
  const { job } = await ctx.params;
  const { env } = await getServerEnv();
  const secret = (env as unknown as { CRON_SECRET?: string }).CRON_SECRET;
  const given = request.headers.get("x-cron-secret") ?? "";
  const handler = JOB_HANDLERS[job];
  if (!secret || secret.length < 16 || !timingSafeEqual(given, secret) || !handler) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const summary = await handler(createDb(env.DB));
    console.log(`cron ${job}: ${summary}`);
    return Response.json({ ok: true, job, summary });
  } catch (e) {
    console.error(`cron ${job} failed`, e);
    return Response.json({ ok: false, job }, { status: 500 });
  }
}
