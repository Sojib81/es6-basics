/**
 * Security headers (Phase 10). CSP allows only what the site uses: GA4/Google Ads (gtag), Meta Pixel,
 * Cloudflare Turnstile. Stripe Checkout is a redirect, so it needs no CSP entry.
 * 'unsafe-inline' scripts are needed for Next.js' inline bootstrap + gtag/pixel snippets (no nonce
 * setup); the other directives (frame-ancestors, object-src, base-uri, form-action) still block a
 * lot. If you add a new third-party script, add its host here or it will be blocked.
 */
export function contentSecurityPolicy(dev = false): string {
  const scripts = [
    "'self'",
    "'unsafe-inline'",
    ...(dev ? ["'unsafe-eval'"] : []),
    "https://www.googletagmanager.com",
    "https://www.google-analytics.com",
    "https://googleads.g.doubleclick.net",
    "https://www.googleadservices.com",
    "https://connect.facebook.net",
    "https://challenges.cloudflare.com",
  ];
  return [
    "default-src 'self'",
    `script-src ${scripts.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:", // tracking pixels come from many Google/Meta hosts
    "font-src 'self'",
    "connect-src 'self' https:", // analytics beacons (region-specific Google hosts)
    "frame-src https://challenges.cloudflare.com https://www.googletagmanager.com https://td.doubleclick.net https://www.facebook.com",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function securityHeaders(dev = false) {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(dev) },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    },
  ];
}
