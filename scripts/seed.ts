/**
 * Prints the idempotent seed SQL to stdout. Used by `npm run db:seed:*`.
 * Validates every seed file with the app's Zod schemas first, so a bad seed never reaches D1.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildSeedSql } from "../lib/db/seed-sql";

const root = join(import.meta.dirname, "..", "seed");
const read = (file: string) => JSON.parse(readFileSync(join(root, file), "utf8"));

process.stdout.write(
  buildSeedSql({
    settings: read("settings.json"),
    adminUsers: read("admin-users.json"),
    templates: existsSync(join(root, "templates.json")) ? read("templates.json") : [],
  }),
);
