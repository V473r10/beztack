import { sendEmail } from "@nvn/email";
import { checkout, polar, portal, usage } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";
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

const polarClient = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN,
  server: "sandbox",
});

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
    "https://acervus-ui.vercel.app",
  ],
  plugins: [
    twoFactor({
      issuer: "nvn",
    }),
    admin(),
    organization({
      requireEmailVerificationOnInvitation: false, // Start with false for development
      async sendInvitationEmail(_data) {
        // TODO: Implement invitation email sending
      },
      organizationDeletion: {
        disabled: false,
        beforeDelete: async (_data, _request) => {
          // TODO: Implement pre-deletion hooks
        },
        afterDelete: async (_data, _request) => {
          // TODO: Implement post-deletion hooks
        },
      },
      teams: {
        enabled: true,
        maximumTeams: 50, // Allow up to 50 teams per organization
        allowRemovingAllTeams: false, // Prevent removing the last team
      },
    }),
    polar({
      client: polarClient,
      createCustomerOnSignUp: true,
      use: [
        checkout({
          products: [
            {
              productId: process.env.POLAR_BASIC_MONTHLY_PRODUCT_ID || "",
              slug: "basic-monthly",
            },
            {
              productId: process.env.POLAR_BASIC_YEARLY_PRODUCT_ID || "",
              slug: "basic-yearly",
            },
            {
              productId: process.env.POLAR_PRO_MONTHLY_PRODUCT_ID || "",
              slug: "pro-monthly",
            },
            {
              productId: process.env.POLAR_PRO_YEARLY_PRODUCT_ID || "",
              slug: "pro-yearly",
            },
            {
              productId: process.env.POLAR_ULTIMATE_MONTHLY_PRODUCT_ID || "",
              slug: "ultimate-monthly",
            },
            {
              productId: process.env.POLAR_ULTIMATE_YEARLY_PRODUCT_ID || "",
              slug: "ultimate-yearly",
            },
          ],
          successUrl: process.env.POLAR_SUCCESS_URL,
          authenticatedUsersOnly: true,
        }),
        portal(),
        usage(),
      ],
    }),
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
  advanced: {
    crossSubDomainCookies: {
      enabled: true,
      domain: "acervus-ui.vercel.app",
    },
  },
});
