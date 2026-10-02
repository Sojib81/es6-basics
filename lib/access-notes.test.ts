import { describe, expect, it } from "vitest";
import { looksLikeAccessCode } from "./access-notes";

describe("looksLikeAccessCode", () => {
  it.each([
    "Lockbox code 4821",
    "keys in lock box, combo 1-2-3-4",
    "alarm 9876",
    "Gate PIN is 2580",
    "keysafe 774",
  ])("warns on %s", (t) => expect(looksLikeAccessCode(t)).toBe(true));

  it.each([
    "Keys with the agent at Ray White Belmont",
    "postcode 6104",
    "Unit 12, gate code is with the agent",
    "Call me on arrival",
    "",
    undefined,
  ])("does not warn on %s", (t) => expect(looksLikeAccessCode(t)).toBe(false));
});
