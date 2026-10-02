/**
 * Prints the idempotent seed SQL to stdout. Used by `npm run db:seed:*`.
 * Validates every seed file with the app's Zod schemas first, so a bad seed never reaches D1.
 */
import { readSeedFiles } from "../lib/db/seed-files";
import { buildSeedSql } from "../lib/db/seed-sql";

process.stdout.write(buildSeedSql(readSeedFiles()));
