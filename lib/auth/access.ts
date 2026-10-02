/**
 * Cloudflare Access verification (BLUEPRINT golden rule 7). Access sits in front of /admin/* and
 * sends a signed JWT on every request; we verify it ourselves AND require an active admin_users row.
 * Deny by default: anything missing or invalid → null.
 */
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { adminUsers } from "@/lib/db/schema";

export type AdminUser = typeof adminUsers.$inferSelect;

const jwksCache = new Map<string, JWTVerifyGetKey>();
function remoteJwks(teamDomain: string): JWTVerifyGetKey {
  let jwks = jwksCache.get(teamDomain);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
    jwksCache.set(teamDomain, jwks);
  }
  return jwks;
}

/** Returns the verified email (lower-case) or null. */
export async function verifyAccessJwt(
  token: string,
  opts: { teamDomain: string; aud: string; keys?: JWTVerifyGetKey },
): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, opts.keys ?? remoteJwks(opts.teamDomain), {
      issuer: `https://${opts.teamDomain}`,
      audience: opts.aud,
      algorithms: ["RS256"],
    });
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : null;
    return email || null;
  } catch {
    return null;
  }
}

export function accessTokenFrom(headers: Headers): string | null {
  const header = headers.get("cf-access-jwt-assertion");
  if (header) return header;
  const cookie = headers.get("cookie") ?? "";
  const m = /(?:^|;\s*)CF_Authorization=([^;]+)/.exec(cookie);
  return m ? decodeURIComponent(m[1]) : null;
}

export type AuthConfig = {
  APP_ENV: "production" | "staging" | "local";
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
  DEV_ADMIN_EMAIL?: string;
};

/** Resolves the signed-in admin for a request, or null. */
export async function resolveAdmin(
  db: Db,
  headers: Headers,
  config: AuthConfig,
  keys?: JWTVerifyGetKey,
): Promise<AdminUser | null> {
  let email: string | null = null;
  if (config.APP_ENV === "local" && config.DEV_ADMIN_EMAIL) {
    email = config.DEV_ADMIN_EMAIL.toLowerCase();
  } else {
    const token = accessTokenFrom(headers);
    if (!token || !config.CF_ACCESS_TEAM_DOMAIN || !config.CF_ACCESS_AUD) return null;
    email = await verifyAccessJwt(token, {
      teamDomain: config.CF_ACCESS_TEAM_DOMAIN,
      aud: config.CF_ACCESS_AUD,
      keys,
    });
  }
  if (!email) return null;
  const [user] = await db.select().from(adminUsers).where(eq(adminUsers.email, email)).limit(1);
  return user && user.active ? user : null;
}

/** Same-origin check for mutating requests (defence in depth on top of Next's own action check). */
export function isSameOrigin(headers: Headers): boolean {
  const origin = headers.get("origin");
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
