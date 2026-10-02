/**
 * Project-wide Zod entry point. Import `z` from here, not from "zod".
 * `jitless` stops Zod probing `new Function` at startup, which our CSP (no 'unsafe-eval')
 * blocks and the browser logs as a violation. Validation results are identical.
 */
import { z } from "zod";

z.config({ jitless: true });

export { z };
