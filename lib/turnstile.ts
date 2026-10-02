/**
 * Cloudflare Turnstile verification. Fails CLOSED in production.
 * Outside production, Cloudflare's documented test secret + dummy token pass without a network call,
 * so local runs and E2E tests work offline.
 */
export const TURNSTILE_TEST_SECRET = "1x0000000000000000000000000000000AA";
export const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";
export const TURNSTILE_DUMMY_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

export async function verifyTurnstile(opts: {
  token: string;
  secret: string | undefined;
  ip?: string | null;
  appEnv: "production" | "staging" | "local";
  fetchImpl?: typeof fetch;
}): Promise<boolean> {
  const { token, secret, ip, appEnv } = opts;
  if (!token) return false;
  if (appEnv !== "production") {
    if (!secret || secret === TURNSTILE_TEST_SECRET) return token === TURNSTILE_DUMMY_TOKEN;
  } else if (!secret || secret === TURNSTILE_TEST_SECRET) {
    console.error("TURNSTILE_SECRET_KEY missing or set to the test key in production");
    return false;
  }

  const body = new FormData();
  body.append("secret", secret!);
  body.append("response", token);
  if (ip) body.append("remoteip", ip);
  try {
    const res = await (opts.fetchImpl ?? fetch)(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body },
    );
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (e) {
    console.error("Turnstile verification failed", e);
    return false;
  }
}
