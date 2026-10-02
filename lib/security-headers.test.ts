import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "./security-headers";

describe("security headers", () => {
  it("CSP blocks framing, plugins and base tag hijacks, and allows only the scripts we use", () => {
    const csp = contentSecurityPolicy();
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("https://challenges.cloudflare.com");
    expect(csp).toContain("https://www.googletagmanager.com");
    expect(csp).toContain("https://connect.facebook.net");
    expect(csp).not.toContain("unsafe-eval");
    expect(contentSecurityPolicy(true)).toContain("unsafe-eval"); // dev only
  });

  it("sets HSTS, nosniff and friends", () => {
    const keys = securityHeaders().map((h) => h.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "Strict-Transport-Security",
        "X-Content-Type-Options",
        "X-Frame-Options",
        "Referrer-Policy",
        "Permissions-Policy",
      ]),
    );
  });
});
