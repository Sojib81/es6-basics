import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

// Incremental cache in R2. The D1 tag cache (for revalidateTag after admin saves) is added in
// Phase 2 together with the data loaders — see DEV_NOTES.md → "Caching".
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
});
