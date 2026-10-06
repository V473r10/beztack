import { db, schema } from "@beztack/db";
import { sendEmail } from "@beztack/email";
import { createPolarAuthPlugin } from "@beztack/payments-polar/auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { env } from "@/env";
import { getPolarProductMappings } from "@/lib/payments/config";
import { getAppAdminEmails } from "./app-admin-emails";
import { createAuth } from "./auth-config";

const isPolarProvider = env.PAYMENT_PROVIDER === "polar";
const paymentsSuccessUrl = env.PAYMENTS_SUCCESS_URL || env.POLAR_SUCCESS_URL;

const polarPlugin = isPolarProvider
  ? createPolarAuthPlugin({
      accessToken: env.POLAR_ACCESS_TOKEN,
      server: env.POLAR_SERVER,
      products: getPolarProductMappings(),
      successUrl: paymentsSuccessUrl,
      authenticatedUsersOnly: true,
      createCustomerOnSignUp: true,
      getCustomerCreateParams: async (data) => {
        return {
          metadata: {
            source: "beztack-signup",
            userId: data.user.id || "unknown",
          },
        };
      },
    })
  : null;

/**
 * The API's better-auth instance: the config from `auth-config.ts` wired to
 * the real database, env and email sender.
 */
export const auth = createAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  appName: env.APP_NAME,
  appUrl: env.APP_URL,
  corsOrigins: env.CORS_ORIGINS,
  appAdminEmails: getAppAdminEmails(),
  sendEmail,
  plugins: polarPlugin ? [polarPlugin] : [],
});
