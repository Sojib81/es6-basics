import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

// Incremental cache in R2 (used by any fetch/ISR caching). Pages that read D1 render per request,
// so admin saves need no tag cache or revalidation — see DEV_NOTES.md → Decisions (caching).
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
});
