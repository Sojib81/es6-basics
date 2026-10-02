/** Web app manifest for the admin only (so the public site isn't installable as the admin app). */
export function GET() {
  return Response.json(
    {
      name: "Admin",
      short_name: "Admin",
      id: "/admin",
      start_url: "/admin",
      scope: "/admin",
      display: "standalone",
      background_color: "#f8fafc",
      theme_color: "#0f766e",
      icons: [
        { src: "/icons/admin-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icons/admin-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        {
          src: "/icons/admin-maskable-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
    },
    {
      headers: {
        "Content-Type": "application/manifest+json",
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
}
