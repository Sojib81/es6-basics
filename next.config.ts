import type { NextConfig } from "next";
import { securityHeaders } from "./lib/security-headers";

const dev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    // No paid Cloudflare Images. Admin uploads are resized to WebP in the browser (Phase 9).
    unoptimized: true,
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders(dev) },
      // Private pages: never cached by browsers or proxies.
      { source: "/admin/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
      {
        source: "/invoice/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "X-Robots-Tag", value: "noindex" },
        ],
      },
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;

// Gives `next dev` access to Cloudflare bindings (D1, R2, vars) via getCloudflareContext().
import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
