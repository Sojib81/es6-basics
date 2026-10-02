import { describe, expect, it } from "vitest";
import { decodeEstimate, encodeEstimate } from "./estimate-params";

describe("estimate params", () => {
  it("round-trips", () => {
    const input = {
      service: "vacate" as const,
      bedrooms: 3,
      bathrooms: 2,
      storeys: 2,
      carpetRooms: 3,
      agentReady: true,
      condition: "heavy" as const,
      addons: [
        { id: "oven", quantity: 1 },
        { id: "blinds", quantity: 3 },
      ],
    };
    expect(decodeEstimate(new URLSearchParams(encodeEstimate(input)))).toEqual(input);
  });

  it("ignores junk and out-of-range values", () => {
    expect(decodeEstimate({ s: "hack" })).toBeNull();
    const d = decodeEstimate({ s: "regular", bd: "99", ba: "-1", ad: "oven,<script>,x:999" })!;
    expect(d.bedrooms).toBeUndefined();
    expect(d.bathrooms).toBeUndefined();
    expect(d.addons).toEqual([
      { id: "oven", quantity: 1 },
      { id: "x", quantity: 1 },
    ]);
  });
});
