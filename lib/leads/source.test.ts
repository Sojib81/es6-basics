import { describe, expect, it } from "vitest";
import { formatIsoDate } from "@/lib/notify/alerts";
import { classifySource } from "./source";

describe("classifySource", () => {
  it.each([
    [{ gclid: "x" }, "Google Ads"],
    [{ utmSource: "google", utmMedium: "cpc" }, "Google Ads"],
    [{ fbclid: "x" }, "Facebook / Instagram"],
    [{ utmSource: "instagram" }, "Facebook / Instagram"],
    [{ bookerRole: "property_manager" }, "Property manager"],
    [{ heardFrom: "Google" }, "Google (organic)"],
    [{ utmSource: "google", utmMedium: "organic" }, "Google (organic)"],
    [{ heardFrom: "Friend or family" }, "Referral"],
    [{}, "Direct / other"],
  ] as const)("%o → %s", (input, expected) => expect(classifySource(input)).toBe(expected));

  it("paid clicks win over what the customer said", () => {
    expect(classifySource({ gclid: "x", heardFrom: "Friend or family" })).toBe("Google Ads");
  });
});

describe("formatIsoDate", () => {
  it("formats without commas, identically everywhere", () => {
    expect(formatIsoDate("2026-10-09")).toBe("Fri 9 Oct");
    expect(formatIsoDate("2026-12-31")).toBe("Thu 31 Dec");
    expect(formatIsoDate(null)).toBe("");
    expect(formatIsoDate("nope")).toBe("");
  });
});
