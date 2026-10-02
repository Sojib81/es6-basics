import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema";

export type Db = DrizzleD1Database<typeof schema>;

export function createDb(d1: D1Database): Db {
  return drizzle(d1, { schema });
}

/**
 * Server-only. The request's D1 database. Calls `connection()` first so any page that reads the DB
 * is rendered per request (never prerendered at build time, when there is no D1).
 */
export async function getDb(): Promise<Db> {
  const { connection } = await import("next/server");
  await connection();
  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  const { env } = await getCloudflareContext({ async: true });
  return createDb(env.DB);
}
