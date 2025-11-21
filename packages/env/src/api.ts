import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * Environment configuration for API (Nitro) applications
 * Uses @t3-oss/env-core for server-side validation
 */
export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here.
   * This makes sure the app isn't built with invalid env vars.
   */
  server: {
    // Database
    DATABASE_URL: z.string().url(),

    // Better Auth
    BETTER_AUTH_SECRET: z.string().min(1),
    BETTER_AUTH_URL: z.string().url(),
    APP_NAME: z.string().min(1).default("beztack"),

    // Polar
    POLAR_ACCESS_TOKEN: z.string().min(1),
    POLAR_WEBHOOK_SECRET: z.string().min(1),
    POLAR_SERVER: z.enum(["sandbox", "production"]).default("sandbox"),
    POLAR_BASIC_MONTHLY_PRODUCT_ID: z.string().uuid(),
    POLAR_BASIC_YEARLY_PRODUCT_ID: z.string().uuid(),
    POLAR_PRO_MONTHLY_PRODUCT_ID: z.string().uuid(),
    POLAR_PRO_YEARLY_PRODUCT_ID: z.string().uuid(),
    POLAR_ULTIMATE_MONTHLY_PRODUCT_ID: z.string().uuid(),
    POLAR_ULTIMATE_YEARLY_PRODUCT_ID: z.string().uuid(),
    POLAR_SUCCESS_URL: z.string().url(),
    POLAR_CANCEL_URL: z.string().url(),
    POLAR_ORGANIZATION_ID: z.string().uuid(),

    // Resend
    RESEND_FROM_NAME: z.string().min(1),
    RESEND_FROM_EMAIL: z.string().email(),
    RESEND_API_KEY: z.string().min(1),

    // Node
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },

  /**
   * What object holds the environment variables at runtime.
   * For Nitro/Node.js, this is `process.env`.
   */
  runtimeEnv: process.env,

  /**
   * Makes it so empty strings are treated as undefined.
   * `SOME_VAR: z.string()` and `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
