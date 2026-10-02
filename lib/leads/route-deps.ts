/** Wires PublicDeps from the Cloudflare request context (route handlers only). */
import { getServerEnv, stripeConfigFrom } from "@/lib/config";
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
    // Burst limiting is skipped locally (E2E runs submit in parallel from one IP); unit-tested instead.
    limiter: config.APP_ENV === "local" ? undefined : env.RATE_LIMITER,
    ip: request.headers.get("cf-connecting-ip"),
    suburbNames: getSuburbs().map((s) => s.name),
    background: ctx ? (p) => ctx.waitUntil(p) : undefined,
    stripe: stripeConfigFrom(config),
  };
}

export const MAX_JSON_BYTES = 32_768;

/** Reads a JSON body (max 32 KB, counted as it streams — Content-Length can't be trusted) or returns null. */
export async function readJson(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_JSON_BYTES || !request.body)
    return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_JSON_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  try {
    const bytes = new Uint8Array(size);
    let o = 0;
    for (const c of chunks) {
      bytes.set(c, o);
      o += c.length;
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}
