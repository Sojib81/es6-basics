import { z } from "zod";

/**
 * Runtime config from Cloudflare vars (wrangler.jsonc `vars`, or `.dev.vars` locally).
 * Secrets are added to this schema as the features that need them are built.
 */
export const runtimeConfigSchema = z
  .object({
    APP_ENV: z.enum(["production", "staging", "local"]),
    ALERTS_MODE: z.enum(["send", "log"]),
  })
  .refine((c) => c.APP_ENV === "production" || c.ALERTS_MODE === "log", {
    message: "ALERTS_MODE must be 'log' outside production so staging/local never text the owners",
    path: ["ALERTS_MODE"],
  });

export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;

export function parseRuntimeConfig(env: Record<string, unknown>): RuntimeConfig {
  const result = runtimeConfigSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid runtime config: ${z.prettifyError(result.error)}`);
  }
  return result.data;
}

/** Server-only. Reads and validates the current environment's vars. */
export async function getRuntimeConfig(): Promise<RuntimeConfig> {
  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  const { env } = await getCloudflareContext({ async: true });
  return parseRuntimeConfig(env as unknown as Record<string, unknown>);
}
