import { describe, expect, it, vi } from "vitest";
import { TURNSTILE_DUMMY_TOKEN, TURNSTILE_TEST_SECRET, verifyTurnstile } from "./turnstile";

describe("verifyTurnstile", () => {
  it("accepts the dummy token offline outside production", async () => {
    const fetchImpl = vi.fn();
    for (const secret of [undefined, TURNSTILE_TEST_SECRET]) {
      expect(
        await verifyTurnstile({ token: TURNSTILE_DUMMY_TOKEN, secret, appEnv: "local", fetchImpl }),
      ).toBe(true);
      expect(await verifyTurnstile({ token: "other", secret, appEnv: "staging", fetchImpl })).toBe(
        false,
      );
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fails closed in production without a real secret", async () => {
    for (const secret of [undefined, TURNSTILE_TEST_SECRET]) {
      expect(
        await verifyTurnstile({ token: TURNSTILE_DUMMY_TOKEN, secret, appEnv: "production" }),
      ).toBe(false);
    }
  });

  it("asks Cloudflare with a real secret", async () => {
    const ok = vi.fn(async () => new Response(JSON.stringify({ success: true })));
    expect(
      await verifyTurnstile({
        token: "t",
        secret: "real",
        ip: "1.2.3.4",
        appEnv: "production",
        fetchImpl: ok,
      }),
    ).toBe(true);
    const body = (ok.mock.calls[0] as unknown as [string, RequestInit])[1].body as FormData;
    expect(body.get("remoteip")).toBe("1.2.3.4");

    const no = vi.fn(async () => new Response(JSON.stringify({ success: false })));
    expect(
      await verifyTurnstile({ token: "t", secret: "real", appEnv: "production", fetchImpl: no }),
    ).toBe(false);

    const down = vi.fn(async () => {
      throw new Error("network");
    });
    expect(
      await verifyTurnstile({ token: "t", secret: "real", appEnv: "production", fetchImpl: down }),
    ).toBe(false);
  });

  it("rejects an empty token", async () => {
    expect(await verifyTurnstile({ token: "", secret: undefined, appEnv: "local" })).toBe(false);
  });
});
