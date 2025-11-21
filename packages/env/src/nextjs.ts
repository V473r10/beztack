import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Environment configuration for Next.js applications
 * Uses @t3-oss/env-nextjs for full-stack validation
 */
export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here.
   * This makes sure the app isn't built with invalid env vars.
   */
  server: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },

  /**
   * Specify your client-side environment variables schema here.
   * For Next.js, these must be prefixed with `NEXT_PUBLIC_`.
   *
   * 💡 You'll get type errors if these are not prefixed with NEXT_PUBLIC_.
   */
  client: {
    // NEXT_PUBLIC_EXAMPLE: z.string().min(1),
  },

  /**
   * For Next.js >= 13.4.4, you only need to destructure client variables.
   * Server variables are automatically available.
   */
  experimental__runtimeEnv: {
    // NEXT_PUBLIC_EXAMPLE: process.env.NEXT_PUBLIC_EXAMPLE,
  },

  /**
   * Makes it so empty strings are treated as undefined.
   * `SOME_VAR: z.string()` and `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
