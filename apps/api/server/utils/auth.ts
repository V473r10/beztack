import { sendEmail } from "@nvn/email";
import { setupPolarForBetterAuth } from "@nvn/payments/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
  admin,
  createAuthMiddleware,
  organization,
  twoFactor,
} from "better-auth/plugins";
import { db } from "@/db/db";
import { schema } from "@/db/schema";

// Setup Polar configuration with proper validation
function getPolarPlugin() {
  // Check required environment variables
  const hasAccessToken = !!process.env.POLAR_ACCESS_TOKEN;
  const hasWebhookSecret = !!process.env.POLAR_WEBHOOK_SECRET;

  if (!hasAccessToken) {
    return null;
  }

  if (!hasWebhookSecret) {
    // Continue without webhooks
  }

  try {
    const polarPlugin = setupPolarForBetterAuth();

    if (polarPlugin) {
      return polarPlugin;
    }

    return null;
  } catch (_error) {
    return null;
  }
}

const polarPlugin = getPolarPlugin();

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  socialProviders: {},
  trustedOrigins: [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://nvn.vercel.app",
  ],
  plugins: [
    twoFactor({
      issuer: "nvn",
    }),
    admin(),
    organization({
      requireEmailVerificationOnInvitation: false, // Start with false for development
      async sendInvitationEmail(_data) {},
      organizationDeletion: {
        disabled: false,
        beforeDelete: async (_data, _request) => {},
        afterDelete: async (_data, _request) => {},
      },
      teams: {
        enabled: true,
        maximumTeams: 50, // Allow up to 50 teams per organization
        allowRemovingAllTeams: false, // Prevent removing the last team
      },
    }),
    // Integrate Polar plugin if available
    ...(polarPlugin ? [polarPlugin] : []),
  ],
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path.includes("/sign-up")) {
        const newSession = ctx.context.newSession;
        if (newSession) {
          await sendEmail({
            type: "welcome",
            to: newSession.user.email,
            data: { username: newSession.user.name },
          });
        }
      }
    }),
  },
});
