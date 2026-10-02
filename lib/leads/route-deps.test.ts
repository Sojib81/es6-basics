import { describe, expect, it } from "vitest";
import { MAX_JSON_BYTES, readJson } from "./route-deps";

const req = (body: string, headers: Record<string, string> = {}) =>
  new Request("https://x.au/api", { method: "POST", body, headers });

describe("readJson", () => {
  it("parses normal JSON", async () => {
    expect(await readJson(req('{"a":1}'))).toEqual({ a: 1 });
  });
  it("rejects bodies over the limit even without a Content-Length header", async () => {
    const big = JSON.stringify({ x: "a".repeat(MAX_JSON_BYTES) });
    const stream = new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode(big));
        c.close();
      },
    });
    const r = new Request("https://x.au/api", {
      method: "POST",
      body: stream,
      duplex: "half",
    } as RequestInit);
    expect(r.headers.get("content-length")).toBeNull();
    expect(await readJson(r)).toBeNull();
  });
  it("rejects bad JSON and declared-too-large bodies", async () => {
    expect(await readJson(req("{nope"))).toBeNull();
    expect(await readJson(req("{}", { "content-length": String(MAX_JSON_BYTES + 1) }))).toBeNull();
  });
});
