/** Builds the NotifyContext from the Cloudflare env (server only). */
import type { RuntimeConfig } from "@/lib/config";
import type { Db } from "@/lib/db/client";
import type { NotifyContext } from "./deliver";
import { createSmsProvider } from "./sms";

export function notifyContextFrom(db: Db, config: RuntimeConfig): NotifyContext {
  return {
    db,
    mode: config.ALERTS_MODE,
    email: {
      apiKey: config.RESEND_API_KEY,
      from: config.EMAIL_FROM,
      replyTo: config.EMAIL_REPLY_TO,
    },
    sms: createSmsProvider(config),
  };
}
