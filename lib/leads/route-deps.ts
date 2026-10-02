/** Wires PublicDeps from the Cloudflare request context (route handlers only). */
import { getServerEnv } from "@/lib/config";
import { createDb } from "@/lib/db/client";
import { getSuburbs } from "@/lib/data/content";
import { notifyContextFrom } from "@/lib/notify/context";
import type { PublicDeps } from "./handle-public";

export async function publicDepsFromRequest(request: Request): Promise<PublicDeps> {
  const { env, config, ctx } = await getServerEnv();
  const db = createDb(env.DB);
  return {
    db,
    config,
    notify: notifyContextFrom(db, config),
    limiter: env.RATE_LIMITER,
    ip: request.headers.get("cf-connecting-ip"),
    suburbNames: getSuburbs().map((s) => s.name),
    background: ctx ? (p) => ctx.waitUntil(p) : undefined,
  };
}

/** Reads a JSON body (max 32 KB) or returns null. */
export async function readJson(request: Request): Promise<unknown> {
  const len = Number(request.headers.get("content-length") ?? 0);
  if (len > 32_768) return null;
  try {
    return await request.json();
  } catch {
    return null;
  }
}
