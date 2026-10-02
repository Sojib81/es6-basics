import { z } from "zod";

const optionalSecret = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

/**
 * Runtime config from Cloudflare vars + secrets (wrangler.jsonc `vars`, `wrangler secret put`,
 * or `.dev.vars` locally). Secrets are optional here so a missing one disables that feature
 * (logged as a failed message) instead of crashing the site.
 */
export const runtimeConfigSchema = z
  .object({
    APP_ENV: z.enum(["production", "staging", "local"]),
    ALERTS_MODE: z.enum(["send", "log"]),
    TURNSTILE_SECRET_KEY: optionalSecret,
    RESEND_API_KEY: optionalSecret,
    EMAIL_FROM: optionalSecret,
    EMAIL_REPLY_TO: optionalSecret,
    SMS_PROVIDER: z.enum(["clicksend", "twilio", "none"]).optional().default("none"),
    SMS_API_USERNAME: optionalSecret,
    SMS_API_KEY: optionalSecret,
    SMS_FROM: optionalSecret,
    CF_ACCESS_TEAM_DOMAIN: optionalSecret,
    CF_ACCESS_AUD: optionalSecret,
    DEV_ADMIN_EMAIL: optionalSecret,
    VAPID_PRIVATE_KEY: optionalSecret,
    SMS_INBOUND_SECRET: optionalSecret,
    VAPID_SUBJECT: optionalSecret,
  })
  .refine((c) => c.APP_ENV === "production" || c.ALERTS_MODE === "log", {
    message: "ALERTS_MODE must be 'log' outside production so staging/local never text the owners",
    path: ["ALERTS_MODE"],
  })
  .refine((c) => c.APP_ENV === "local" || !c.DEV_ADMIN_EMAIL, {
    message: "DEV_ADMIN_EMAIL (admin login bypass) is only allowed when APP_ENV=local",
    path: ["DEV_ADMIN_EMAIL"],
  });

export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;

export function parseRuntimeConfig(env: Record<string, unknown>): RuntimeConfig {
  const result = runtimeConfigSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid runtime config: ${z.prettifyError(result.error)}`);
  }
  return result.data;
}

/** Server-only. The Cloudflare env (bindings + vars) and the validated config. */
export async function getServerEnv(): Promise<{
  env: CloudflareEnv;
  config: RuntimeConfig;
  ctx: { waitUntil(p: Promise<unknown>): void } | undefined;
}> {
  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  const { env, ctx } = await getCloudflareContext({ async: true });
  return {
    env,
    config: parseRuntimeConfig(env as unknown as Record<string, unknown>),
    ctx: ctx as { waitUntil(p: Promise<unknown>): void } | undefined,
  };
}

export async function getRuntimeConfig(): Promise<RuntimeConfig> {
  return (await getServerEnv()).config;
}

/** Public site URL, e.g. https://example.com.au (no trailing slash). */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
