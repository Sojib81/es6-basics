import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/api",
          "/invoice",
          "/book",
          "/thank-you",
          "/booking",
          "/access-denied",
        ],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
