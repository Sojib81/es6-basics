import { describe, expect, it } from "vitest";
import { diffSummary } from "./audit-diff";

describe("diffSummary", () => {
  it("lists changed fields only, ignoring timestamps", () => {
    expect(
      diffSummary(
        { status: "new", updatedAt: 1, x: 1 },
        { status: "contacted", updatedAt: 2, x: 1 },
      ),
    ).toEqual(["status: new → contacted"]);
    expect(diffSummary(null, { title: "Hi" })).toEqual(["title: Hi"]);
    expect(diffSummary({ a: [1] }, { a: [1, 2] })).toEqual(["a: [1] → [1,2]"]);
  });
  it("truncates long values and many fields", () => {
    expect(diffSummary({ t: "x".repeat(200) }, { t: "y" })[0].length).toBeLessThan(100);
    const many = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`k${i}`, i]));
    expect(diffSummary({}, many, 3)).toHaveLength(4);
  });
});
