import { describe, expect, it } from "vitest";
import seed from "@/seed/suburbs.json";
import { suburbSchema, type Suburb } from "@/lib/schemas/content";
import { isIndexable, nearbySuburbs, wordCount } from "./suburbs";

const suburbs = suburbSchema.array().parse(seed);
const long = Array.from({ length: 160 }, (_, i) => `word${i}`).join(" ");
const make = (slug: string, intro: string, active = true): Suburb => ({
  slug,
  name: slug,
  postcode: "6100",
  intro,
  nearby: [],
  featuredServices: [],
  active,
});

describe("suburb indexing rules", () => {
  it("needs ≥150 words, unique text and an active suburb", () => {
    const a = make("a", long);
    const b = make("b", "short intro");
    const c = make("c", long); // duplicate of a
    expect(isIndexable(a, [a, b])).toBe(true);
    expect(isIndexable(b, [a, b])).toBe(false);
    expect(isIndexable(a, [a, c])).toBe(false);
    expect(isIndexable(make("d", long, false), [])).toBe(false);
  });

  it("seed: at most 6 indexed at launch, all nearby links valid", () => {
    const indexed = suburbs.filter((s) => isIndexable(s, suburbs));
    expect(indexed.length).toBeGreaterThan(0);
    expect(indexed.length).toBeLessThanOrEqual(6);
    for (const s of indexed) expect(wordCount(s.intro)).toBeGreaterThanOrEqual(150);
    const slugs = new Set(suburbs.map((s) => s.slug));
    for (const s of suburbs)
      for (const n of s.nearby) expect(slugs.has(n), `${s.slug} → ${n}`).toBe(true);
    for (const s of suburbs) expect(nearbySuburbs(s, suburbs).length).toBeGreaterThan(0);
  });
});
