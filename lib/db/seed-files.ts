/** Node-only: reads /seed/*.json for the seed script and tests. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SeedInput } from "./seed-sql";

export const SEED_DIR = join(import.meta.dirname, "..", "..", "seed");

export function readSeedFiles(dir: string = SEED_DIR): SeedInput {
  const read = (file: string) => JSON.parse(readFileSync(join(dir, file), "utf8"));
  const optional = (file: string) => (existsSync(join(dir, file)) ? read(file) : []);
  return {
    settings: read("settings.json"),
    adminUsers: read("admin-users.json"),
    templates: optional("templates.json"),
    services: optional("services.json"),
    faqs: optional("faqs.json"),
    policies: optional("policies.json"),
  };
}
