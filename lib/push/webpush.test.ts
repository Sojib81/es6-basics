import { describe, expect, it, vi } from "vitest";
import { importJWK, jwtVerify } from "jose";
import {
  b64url,
  encryptPayload,
  generateVapidKeys,
  sendWebPush,
  vapidAuthorization,
} from "./webpush";

// RFC 8291 Appendix A test vector
const V = {
  plaintext: "When I grow up, I want to be a watermelon",
  asPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  asPublic:
    "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  uaPublic:
    "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  auth: "BTBZMqHH6r4Tts7J_aSIgg",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  body: "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
};

describe("Web Push encryption (RFC 8291)", () => {
  it("matches the RFC test vector byte for byte", async () => {
    const out = await encryptPayload(
      new TextEncoder().encode(V.plaintext),
      { p256dh: V.uaPublic, auth: V.auth },
      {
        salt: b64url.decode(V.salt),
        serverPrivate: b64url.decode(V.asPrivate),
        serverPublic: b64url.decode(V.asPublic),
      },
    );
    expect(b64url.encode(out)).toBe(V.body);
  });

  it("uses a fresh salt and server key each time", async () => {
    const a = await encryptPayload(new TextEncoder().encode("x"), {
      p256dh: V.uaPublic,
      auth: V.auth,
    });
    const b = await encryptPayload(new TextEncoder().encode("x"), {
      p256dh: V.uaPublic,
      auth: V.auth,
    });
    expect(b64url.encode(a.slice(0, 16))).not.toBe(b64url.encode(b.slice(0, 16)));
  });
});

describe("VAPID (RFC 8292)", () => {
  it("produces an ES256 JWT for the push service origin that verifies with the public key", async () => {
    const keys = await generateVapidKeys();
    const now = new Date();
    const header = await vapidAuthorization({
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
      subject: "mailto:a@b.com",
      ...keys,
      now,
    });
    const m = /^vapid t=([^,]+), k=(.+)$/.exec(header)!;
    expect(m[2]).toBe(keys.publicKey);
    const pub = b64url.decode(keys.publicKey);
    const jwk = await importJWK(
      {
        kty: "EC",
        crv: "P-256",
        x: b64url.encode(pub.slice(1, 33)),
        y: b64url.encode(pub.slice(33)),
      },
      "ES256",
    );
    const { payload } = await jwtVerify(m[1], jwk, { audience: "https://fcm.googleapis.com" });
    expect(payload.sub).toBe("mailto:a@b.com");
    expect(payload.exp! - Math.floor(now.getTime() / 1000)).toBe(12 * 3600);
  });
});

describe("sendWebPush", () => {
  const sub = { endpoint: "https://push.example.com/abc", p256dh: V.uaPublic, auth: V.auth };
  it("posts an encrypted body with the right headers and flags dead subscriptions", async () => {
    const keys = await generateVapidKeys();
    const ok = vi.fn(async () => new Response(null, { status: 201 }));
    expect(
      await sendWebPush(sub, { title: "Hi" }, { subject: "mailto:a@b.com", ...keys }, ok),
    ).toEqual({ ok: true });
    const init = (ok.mock.calls[0] as unknown as [string, RequestInit])[1];
    const h = init.headers as Record<string, string>;
    expect(h["Content-Encoding"]).toBe("aes128gcm");
    expect(h.Authorization).toMatch(/^vapid t=/);

    const gone = vi.fn(async () => new Response("expired", { status: 410 }));
    expect(await sendWebPush(sub, {}, { subject: "mailto:a@b.com", ...keys }, gone)).toMatchObject({
      ok: false,
      gone: true,
    });
    const flaky = vi.fn(async () => new Response("busy", { status: 503 }));
    expect(await sendWebPush(sub, {}, { subject: "mailto:a@b.com", ...keys }, flaky)).toMatchObject(
      { ok: false, gone: false },
    );
  });
});
