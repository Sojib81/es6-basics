/**
 * Guard rails that fail the build if someone adds an admin page/action/route without an auth check,
 * or a cron expression without a job. Cheap static checks on the source files.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { CRON_JOBS } from "./cron/schedule";

const ROOT = join(import.meta.dirname, "..");
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const files = walk(join(ROOT, "app")).filter((f) => /\.(ts|tsx)$/.test(f));
const rel = (f: string) => relative(ROOT, f);

describe("admin is locked down", () => {
  it("every admin page calls requireAdmin()", () => {
    const pages = files.filter((f) => f.includes("/app/admin/") && f.endsWith("page.tsx"));
    expect(pages.length).toBeGreaterThan(15);
    for (const f of pages) expect(readFileSync(f, "utf8"), rel(f)).toMatch(/requireAdmin\(\)/);
  });

  it("every exported server action under /admin calls requireAdminAction() first", () => {
    const actionFiles = files.filter(
      (f) => f.includes("/app/admin/") && /^["']use server["']/.test(readFileSync(f, "utf8")),
    );
    expect(actionFiles.length).toBeGreaterThan(4);
    for (const f of actionFiles) {
      const chunks = readFileSync(f, "utf8")
        .split(/export async function /)
        .slice(1);
      for (const chunk of chunks) {
        const name = chunk.slice(0, chunk.indexOf("("));
        const body = chunk.slice(0, 600);
        expect(body, `${rel(f)} → ${name}`).toMatch(/await requireAdminAction\(\)/);
      }
    }
  });

  it("every admin API/export route checks the admin", () => {
    const routes = files.filter(
      (f) => (f.includes("/app/api/admin/") || f.includes("/app/admin/")) && f.endsWith("route.ts"),
    );
    expect(routes.length).toBeGreaterThan(2);
    for (const f of routes)
      expect(readFileSync(f, "utf8"), rel(f)).toMatch(/getAdmin\(\)|csvDownload\(/);
  });

  it("webhook/cron endpoints verify a secret or signature", () => {
    const check = (path: string, re: RegExp) =>
      expect(readFileSync(join(ROOT, path), "utf8"), path).toMatch(re);
    check("app/api/cron/[job]/route.ts", /CRON_SECRET/);
    check("app/api/stripe/webhook/route.ts", /verifyStripeWebhook/);
    check("app/api/sms/inbound/route.ts", /SMS_INBOUND_SECRET/);
  });
});

describe("cron schedule", () => {
  it("wrangler.jsonc production crons match lib/cron/schedule.ts exactly", () => {
    const raw = readFileSync(join(ROOT, "wrangler.jsonc"), "utf8");
    const top = raw.slice(raw.indexOf('"triggers"'), raw.indexOf('"env"'));
    const crons = [
      ...top.matchAll(/"([0-9*/,\- ]+ [0-9*/,\- ]+ [0-9*/,\- ]+ [0-9*/,\- ]+ [0-9*/,\- ]+)"/g),
    ].map((m) => m[1]);
    expect(crons.sort()).toEqual(Object.keys(CRON_JOBS).sort());
  });
});
