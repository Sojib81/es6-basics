/** Prints a new VAPID key pair for Web Push. Run once: `npx tsx scripts/vapid-keys.ts`. */
import { generateVapidKeys } from "../lib/push/webpush";

const { publicKey, privateKey } = await generateVapidKeys();
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}   # build variable (Workers Builds) + .env`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}             # wrangler secret put VAPID_PRIVATE_KEY`);
console.log(`VAPID_SUBJECT=mailto:you@yourdomain         # wrangler secret put VAPID_SUBJECT`);
