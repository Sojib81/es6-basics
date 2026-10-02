/**
 * Web Push with WebCrypto only (runs on Workers): RFC 8291 message encryption (aes128gcm, RFC 8188)
 * and RFC 8292 VAPID authentication. The `web-push` npm package needs Node crypto, so we don't use it.
 */
export const b64url = {
  encode(bytes: Uint8Array): string {
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  },
  decode(str: string): Uint8Array<ArrayBuffer> {
    const s = str
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(str.length / 4) * 4, "=");
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },
};

const enc = new TextEncoder();

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

async function hmac(
  key: Uint8Array<ArrayBuffer>,
  data: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}

/** HKDF with a single output block (≤ 32 bytes), as used by RFC 8291. */
async function hkdf(
  salt: Uint8Array<ArrayBuffer>,
  ikm: Uint8Array<ArrayBuffer>,
  info: Uint8Array<ArrayBuffer>,
  length: number,
) {
  const prk = await hmac(salt, ikm);
  return (await hmac(prk, concat(info, new Uint8Array([1])))).slice(0, length);
}

function p256Jwk(publicKey: Uint8Array, d?: Uint8Array): JsonWebKey {
  if (publicKey.length !== 65 || publicKey[0] !== 4)
    throw new Error("Expected an uncompressed P-256 public key");
  return {
    kty: "EC",
    crv: "P-256",
    x: b64url.encode(publicKey.slice(1, 33)),
    y: b64url.encode(publicKey.slice(33, 65)),
    ...(d ? { d: b64url.encode(d) } : {}),
    ext: true,
  };
}

export type PushSubscriptionKeys = { endpoint: string; p256dh: string; auth: string };

/** Encrypts a payload for one subscription (RFC 8291). `salt` / `serverKeys` are for tests only. */
export async function encryptPayload(
  plaintext: Uint8Array<ArrayBuffer>,
  sub: { p256dh: string; auth: string },
  testing?: {
    salt: Uint8Array<ArrayBuffer>;
    serverPrivate: Uint8Array;
    serverPublic: Uint8Array<ArrayBuffer>;
  },
): Promise<Uint8Array<ArrayBuffer>> {
  const uaPublic = b64url.decode(sub.p256dh);
  const authSecret = b64url.decode(sub.auth);
  const salt = testing?.salt ?? crypto.getRandomValues(new Uint8Array(16));

  let asPrivate: CryptoKey;
  let asPublic: Uint8Array<ArrayBuffer>;
  if (testing) {
    asPrivate = await crypto.subtle.importKey(
      "jwk",
      p256Jwk(testing.serverPublic, testing.serverPrivate),
      { name: "ECDH", namedCurve: "P-256" },
      false,
      ["deriveBits"],
    );
    asPublic = testing.serverPublic;
  } else {
    const pair = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
      "deriveBits",
    ])) as CryptoKeyPair;
    asPrivate = pair.privateKey;
    asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  }

  const uaKey = await crypto.subtle.importKey(
    "raw",
    uaPublic,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, asPrivate, 256),
  );

  const keyInfo = concat(enc.encode("WebPush: info\0"), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

  const padded = concat(plaintext, new Uint8Array([2])); // single, last record
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, padded),
  );

  const rs = new Uint8Array([0, 0, 16, 0]); // record size 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, ciphertext);
}

/** VAPID JWT (ES256) for the push service's origin (RFC 8292). */
export async function vapidAuthorization(opts: {
  endpoint: string;
  subject: string; // mailto:… or https://…
  publicKey: string; // base64url, uncompressed P-256
  privateKey: string; // base64url, 32-byte d
  now?: Date;
}): Promise<string> {
  const aud = new URL(opts.endpoint).origin;
  const exp = Math.floor((opts.now ?? new Date()).getTime() / 1000) + 12 * 3600;
  const header = b64url.encode(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64url.encode(enc.encode(JSON.stringify({ aud, exp, sub: opts.subject })));
  const signingInput = `${header}.${claims}`;
  const key = await crypto.subtle.importKey(
    "jwk",
    p256Jwk(b64url.decode(opts.publicKey), b64url.decode(opts.privateKey)),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  // WebCrypto returns raw r||s (IEEE P1363), which is exactly the JWS ES256 format.
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(signingInput)),
  );
  return `vapid t=${signingInput}.${b64url.encode(sig)}, k=${opts.publicKey}`;
}

export type PushResult = { ok: true } | { ok: false; status: number; gone: boolean; error: string };

/** Sends one notification. `gone` = the subscription is dead (404/410) and should be deleted. */
export async function sendWebPush(
  sub: PushSubscriptionKeys,
  payload: unknown,
  vapid: { subject: string; publicKey: string; privateKey: string },
  fetchImpl: typeof fetch = fetch,
): Promise<PushResult> {
  try {
    const body = await encryptPayload(enc.encode(JSON.stringify(payload)), sub);
    const res = await fetchImpl(sub.endpoint, {
      method: "POST",
      headers: {
        Authorization: await vapidAuthorization({ endpoint: sub.endpoint, ...vapid }),
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: "3600",
        Urgency: "high",
      },
      body,
    });
    if (res.ok) return { ok: true };
    return {
      ok: false,
      status: res.status,
      gone: res.status === 404 || res.status === 410,
      error: (await res.text()).slice(0, 200),
    };
  } catch (e) {
    return { ok: false, status: 0, gone: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

/** One-off: generate a VAPID key pair (scripts/vapid-keys.ts). */
export async function generateVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const pub = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  return { publicKey: b64url.encode(pub), privateKey: jwk.d! };
}
