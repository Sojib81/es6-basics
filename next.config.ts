import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // No paid Cloudflare Images. Admin uploads are resized to WebP client-side (Phase 9).
    unoptimized: true,
  },
};

export default nextConfig;

// Gives `next dev` access to Cloudflare bindings (D1, R2, vars) via getCloudflareContext().
import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
