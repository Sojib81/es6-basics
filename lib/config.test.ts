import { describe, expect, it } from "vitest";
import { parseRuntimeConfig } from "./config";

describe("parseRuntimeConfig", () => {
  it("accepts production with real alerts", () => {
    expect(parseRuntimeConfig({ APP_ENV: "production", ALERTS_MODE: "send" })).toEqual({
      APP_ENV: "production",
      ALERTS_MODE: "send",
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

  it("rejects missing or unknown values", () => {
    expect(() => parseRuntimeConfig({})).toThrow();
    expect(() => parseRuntimeConfig({ APP_ENV: "prod", ALERTS_MODE: "send" })).toThrow();
  });
});
