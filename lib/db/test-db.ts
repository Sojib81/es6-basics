/**
 * Test-only helper: a real local D1 (Miniflare via wrangler's getPlatformProxy), with all
 * migrations applied. Same SQLite engine and D1 API (incl. batch) as production.
 *
 *   const t = await createTestDb();      // once per test file (beforeAll)
 *   await t.reset();                     // between tests (beforeEach)
 *   await t.dispose();                   // afterAll
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getPlatformProxy } from "wrangler";
import { createDb, type Db } from "./client";
import { readSeedFiles } from "./seed-files";
import { buildSeedStatements, type SeedInput } from "./seed-sql";

export { readSeedFiles };

const ROOT = join(import.meta.dirname, "..", "..");

function migrationStatements(): string[] {
  const dir = join(ROOT, "drizzle");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .flatMap((f) => readFileSync(join(dir, f), "utf8").split("--> statement-breakpoint"))
    .map((s) => s.trim())
    .filter(Boolean);
}

async function execAll(d1: D1Database, statements: string[]) {
  if (statements.length) await d1.batch(statements.map((s) => d1.prepare(s)));
}

export type TestDb = {
  db: Db;
  d1: D1Database;
  /** Local R2 bucket (MEDIA binding) for media tests. */
  media: R2Bucket;
  reset: () => Promise<void>;
  seed: (input?: SeedInput) => Promise<void>;
  dispose: () => Promise<void>;
};

export async function createTestDb(): Promise<TestDb> {
  const proxy = await getPlatformProxy<CloudflareEnv>({
    configPath: join(ROOT, "wrangler.jsonc"),
    persist: false,
  });
  const d1 = proxy.env.DB;
  const db = createDb(d1);

  const tables = async () =>
    (
      await d1
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_%'",
        )
        .all<{ name: string }>()
    ).results.map((r) => r.name);

  const reset = async () => {
    const existing = await tables();
    await execAll(d1, [
      "PRAGMA defer_foreign_keys = true",
      ...existing.map((t) => `DROP TABLE "${t}"`),
    ]);
    await execAll(d1, migrationStatements());
  };

  const seed = async (input: SeedInput = readSeedFiles()) => {
    await execAll(d1, buildSeedStatements(input));
  };

  await reset();
  return { db, d1, media: proxy.env.MEDIA, reset, seed, dispose: () => proxy.dispose() };
}
