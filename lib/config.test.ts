import { describe, expect, it } from "vitest";
import { parseRuntimeConfig } from "./config";

describe("parseRuntimeConfig", () => {
  it("accepts production with real alerts", () => {
    expect(parseRuntimeConfig({ APP_ENV: "production", ALERTS_MODE: "send" })).toMatchObject({
      APP_ENV: "production",
      ALERTS_MODE: "send",
      SMS_PROVIDER: "none",
    });
  });

  it("accepts staging and local in log mode", () => {
    expect(parseRuntimeConfig({ APP_ENV: "staging", ALERTS_MODE: "log" }).APP_ENV).toBe("staging");
    expect(parseRuntimeConfig({ APP_ENV: "local", ALERTS_MODE: "log" }).APP_ENV).toBe("local");
  });

  it("refuses to send real alerts outside production", () => {
    expect(() => parseRuntimeConfig({ APP_ENV: "staging", ALERTS_MODE: "send" })).toThrow(
      /ALERTS_MODE/,
    );
    expect(() => parseRuntimeConfig({ APP_ENV: "local", ALERTS_MODE: "send" })).toThrow(
      /ALERTS_MODE/,
    );
  });

  it("allows the admin login bypass only locally", () => {
    expect(
      parseRuntimeConfig({ APP_ENV: "local", ALERTS_MODE: "log", DEV_ADMIN_EMAIL: "a@b.com" })
        .DEV_ADMIN_EMAIL,
    ).toBe("a@b.com");
    expect(() =>
      parseRuntimeConfig({ APP_ENV: "staging", ALERTS_MODE: "log", DEV_ADMIN_EMAIL: "a@b.com" }),
    ).toThrow(/DEV_ADMIN_EMAIL/);
    expect(() =>
      parseRuntimeConfig({
        APP_ENV: "production",
        ALERTS_MODE: "send",
        DEV_ADMIN_EMAIL: "a@b.com",
      }),
    ).toThrow(/DEV_ADMIN_EMAIL/);
  });

  it("treats blank secrets as missing", () => {
    expect(
      parseRuntimeConfig({ APP_ENV: "local", ALERTS_MODE: "log", RESEND_API_KEY: " " })
        .RESEND_API_KEY,
    ).toBeUndefined();
  });

  it("rejects missing or unknown values", () => {
    expect(() => parseRuntimeConfig({})).toThrow();
    expect(() => parseRuntimeConfig({ APP_ENV: "prod", ALERTS_MODE: "send" })).toThrow();
  });
});
