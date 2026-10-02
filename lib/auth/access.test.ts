import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTVerifyGetKey } from "jose";
import { adminUsers } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/lib/db/test-db";
import { accessTokenFrom, isSameOrigin, resolveAdmin, verifyAccessJwt } from "./access";

const TEAM = "example.cloudflareaccess.com";
const AUD = "aud-tag-123";
let keys: JWTVerifyGetKey;
let sign: (
  claims: Record<string, unknown>,
  opts?: { iss?: string; aud?: string; exp?: string },
) => Promise<string>;
let otherSign: typeof sign;
let t: TestDb;

beforeAll(async () => {
  const make = async () => {
    const { publicKey, privateKey } = await generateKeyPair("RS256");
    const jwk = { ...(await exportJWK(publicKey)), kid: crypto.randomUUID(), alg: "RS256" };
    const fn: typeof sign = (claims, o = {}) =>
      new SignJWT(claims)
        .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
        .setIssuer(o.iss ?? `https://${TEAM}`)
        .setAudience(o.aud ?? AUD)
        .setIssuedAt()
        .setExpirationTime(o.exp ?? "1h")
        .sign(privateKey);
    return { jwk, fn };
  };
  const a = await make();
  const b = await make();
  keys = createLocalJWKSet({ keys: [a.jwk] });
  sign = a.fn;
  otherSign = b.fn;
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.dispose());
beforeEach(async () => {
  await t.reset();
  await t.db.insert(adminUsers).values([
    { email: "owner@example.com", name: "Owner", active: true },
    { email: "gone@example.com", name: "Gone", active: false },
  ]);
});

const cfg = { APP_ENV: "production" as const, CF_ACCESS_TEAM_DOMAIN: TEAM, CF_ACCESS_AUD: AUD };
const withToken = (token: string) => new Headers({ "cf-access-jwt-assertion": token });

describe("verifyAccessJwt", () => {
  it("accepts a valid token and lower-cases the email", async () => {
    expect(
      await verifyAccessJwt(await sign({ email: "Owner@Example.com" }), {
        teamDomain: TEAM,
        aud: AUD,
        keys,
      }),
    ).toBe("owner@example.com");
  });

  it("rejects wrong audience, issuer, signer, or expiry", async () => {
    const o = { teamDomain: TEAM, aud: AUD, keys };
    expect(await verifyAccessJwt(await sign({ email: "a@b.com" }, { aud: "other" }), o)).toBeNull();
    expect(
      await verifyAccessJwt(await sign({ email: "a@b.com" }, { iss: "https://evil.com" }), o),
    ).toBeNull();
    expect(await verifyAccessJwt(await otherSign({ email: "a@b.com" }), o)).toBeNull();
    expect(await verifyAccessJwt(await sign({ email: "a@b.com" }, { exp: "-1m" }), o)).toBeNull();
    expect(await verifyAccessJwt("not-a-jwt", o)).toBeNull();
    expect(await verifyAccessJwt(await sign({}), o)).toBeNull();
  });
});

describe("resolveAdmin", () => {
  it("returns active admins only", async () => {
    expect(
      (await resolveAdmin(t.db, withToken(await sign({ email: "owner@example.com" })), cfg, keys))
        ?.email,
    ).toBe("owner@example.com");
    expect(
      await resolveAdmin(t.db, withToken(await sign({ email: "gone@example.com" })), cfg, keys),
    ).toBeNull();
    expect(
      await resolveAdmin(t.db, withToken(await sign({ email: "stranger@example.com" })), cfg, keys),
    ).toBeNull();
  });

  it("denies when there is no token or Access isn't configured", async () => {
    expect(await resolveAdmin(t.db, new Headers(), cfg, keys)).toBeNull();
    const token = await sign({ email: "owner@example.com" });
    expect(await resolveAdmin(t.db, withToken(token), { APP_ENV: "production" }, keys)).toBeNull();
  });

  it("uses the dev bypass only when APP_ENV=local", async () => {
    expect(
      (
        await resolveAdmin(t.db, new Headers(), {
          APP_ENV: "local",
          DEV_ADMIN_EMAIL: "owner@example.com",
        })
      )?.email,
    ).toBe("owner@example.com");
    expect(
      await resolveAdmin(
        t.db,
        new Headers(),
        { ...cfg, APP_ENV: "staging", DEV_ADMIN_EMAIL: "owner@example.com" },
        keys,
      ),
    ).toBeNull();
  });

  it("reads the CF_Authorization cookie as a fallback", async () => {
    const token = await sign({ email: "owner@example.com" });
    const h = new Headers({ cookie: `a=1; CF_Authorization=${token}; b=2` });
    expect(accessTokenFrom(h)).toBe(token);
    expect((await resolveAdmin(t.db, h, cfg, keys))?.email).toBe("owner@example.com");
  });
});

describe("isSameOrigin", () => {
  it("matches origin host to request host", () => {
    expect(isSameOrigin(new Headers({ origin: "https://site.com.au", host: "site.com.au" }))).toBe(
      true,
    );
    expect(isSameOrigin(new Headers({ origin: "https://evil.com", host: "site.com.au" }))).toBe(
      false,
    );
    expect(isSameOrigin(new Headers({ host: "site.com.au" }))).toBe(false);
    expect(isSameOrigin(new Headers({ origin: "null", host: "site.com.au" }))).toBe(false);
  });
});
