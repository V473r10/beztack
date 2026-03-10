import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const URL_SCHEMA = z.string().url();
const UUID_SCHEMA = z.string().uuid();

const PAYMENT_PROVIDERS = ["polar", "mercadopago"] as const;

function assertRequired(name: string, value: string): void {
  if (!value) {
    throw new Error(
      `Missing required environment variable "${name}" for the selected payment provider`
    );
  }
}

function assertUrl(name: string, value: string): void {
  const parsed = URL_SCHEMA.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Environment variable "${name}" must be a valid URL`);
  }
}

function assertUuid(name: string, value: string): void {
  const parsed = UUID_SCHEMA.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Environment variable "${name}" must be a valid UUID`);
  }
}

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
    POLAR_ACCESS_TOKEN: z.string().default(""),
    POLAR_WEBHOOK_SECRET: z.string().default(""),
    POLAR_SERVER: z.enum(["sandbox", "production"]).default("sandbox"),
    POLAR_BASIC_MONTHLY_PRODUCT_ID: z.string().default(""),
    POLAR_BASIC_YEARLY_PRODUCT_ID: z.string().default(""),
    POLAR_PRO_MONTHLY_PRODUCT_ID: z.string().default(""),
    POLAR_PRO_YEARLY_PRODUCT_ID: z.string().default(""),
    POLAR_ULTIMATE_MONTHLY_PRODUCT_ID: z.string().default(""),
    POLAR_ULTIMATE_YEARLY_PRODUCT_ID: z.string().default(""),
    POLAR_SUCCESS_URL: z.string().default(""),
    POLAR_CANCEL_URL: z.string().default(""),
    POLAR_ORGANIZATION_ID: z.string().default(""),

    // Provider-neutral payment URLs (preferred)
    PAYMENTS_SUCCESS_URL: z.string().default(""),
    PAYMENTS_CANCEL_URL: z.string().default(""),

    // Resend
    RESEND_FROM_NAME: z.string().min(1),
    RESEND_FROM_EMAIL: z.string().email(),
    RESEND_API_KEY: z.string().min(1),

    // MercadoPago
    MERCADO_PAGO_ACCESS_TOKEN: z.string().default(""),
    MERCADO_PAGO_WEBHOOK_SECRET: z.string().default(""),
    MERCADO_PAGO_INTEGRATOR_ID: z.string().default(""),

    // Payment Provider Switch
    PAYMENT_PROVIDER: z.enum(PAYMENT_PROVIDERS).default("polar"),

    // Subscription Mode
    SUBSCRIPTION_MODE: z.enum(["user", "organization"]).default("organization"),

    // UI URL
    APP_URL: z.string().url(),

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

const activePaymentProvider = env.PAYMENT_PROVIDER;
const successUrl = env.PAYMENTS_SUCCESS_URL || env.POLAR_SUCCESS_URL;
const cancelUrl = env.PAYMENTS_CANCEL_URL || env.POLAR_CANCEL_URL;

assertRequired("PAYMENTS_SUCCESS_URL or POLAR_SUCCESS_URL", successUrl);
assertRequired("PAYMENTS_CANCEL_URL or POLAR_CANCEL_URL", cancelUrl);
assertUrl("PAYMENTS_SUCCESS_URL/POLAR_SUCCESS_URL", successUrl);
assertUrl("PAYMENTS_CANCEL_URL/POLAR_CANCEL_URL", cancelUrl);

if (activePaymentProvider === "polar") {
  assertRequired("POLAR_ACCESS_TOKEN", env.POLAR_ACCESS_TOKEN);
  assertRequired("POLAR_WEBHOOK_SECRET", env.POLAR_WEBHOOK_SECRET);
  assertRequired(
    "POLAR_BASIC_MONTHLY_PRODUCT_ID",
    env.POLAR_BASIC_MONTHLY_PRODUCT_ID
  );
  assertRequired(
    "POLAR_BASIC_YEARLY_PRODUCT_ID",
    env.POLAR_BASIC_YEARLY_PRODUCT_ID
  );
  assertRequired(
    "POLAR_PRO_MONTHLY_PRODUCT_ID",
    env.POLAR_PRO_MONTHLY_PRODUCT_ID
  );
  assertRequired(
    "POLAR_PRO_YEARLY_PRODUCT_ID",
    env.POLAR_PRO_YEARLY_PRODUCT_ID
  );
  assertRequired(
    "POLAR_ULTIMATE_MONTHLY_PRODUCT_ID",
    env.POLAR_ULTIMATE_MONTHLY_PRODUCT_ID
  );
  assertRequired(
    "POLAR_ULTIMATE_YEARLY_PRODUCT_ID",
    env.POLAR_ULTIMATE_YEARLY_PRODUCT_ID
  );
  assertRequired("POLAR_ORGANIZATION_ID", env.POLAR_ORGANIZATION_ID);

  assertUuid(
    "POLAR_BASIC_MONTHLY_PRODUCT_ID",
    env.POLAR_BASIC_MONTHLY_PRODUCT_ID
  );
  assertUuid(
    "POLAR_BASIC_YEARLY_PRODUCT_ID",
    env.POLAR_BASIC_YEARLY_PRODUCT_ID
  );
  assertUuid("POLAR_PRO_MONTHLY_PRODUCT_ID", env.POLAR_PRO_MONTHLY_PRODUCT_ID);
  assertUuid("POLAR_PRO_YEARLY_PRODUCT_ID", env.POLAR_PRO_YEARLY_PRODUCT_ID);
  assertUuid(
    "POLAR_ULTIMATE_MONTHLY_PRODUCT_ID",
    env.POLAR_ULTIMATE_MONTHLY_PRODUCT_ID
  );
  assertUuid(
    "POLAR_ULTIMATE_YEARLY_PRODUCT_ID",
    env.POLAR_ULTIMATE_YEARLY_PRODUCT_ID
  );
  assertUuid("POLAR_ORGANIZATION_ID", env.POLAR_ORGANIZATION_ID);
}

if (activePaymentProvider === "mercadopago") {
  assertRequired("MERCADO_PAGO_ACCESS_TOKEN", env.MERCADO_PAGO_ACCESS_TOKEN);
}
