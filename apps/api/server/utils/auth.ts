import { sendEmail } from "@beztack/email";
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
import { db, schema } from "@beztack/db";
import { env } from "@/env";

const polarClient = new Polar({
  accessToken: env.POLAR_ACCESS_TOKEN,
  server: env.POLAR_SERVER,
});

// Determine project name: in development use APP_NAME from env (defaults to "beztack" in .env.example),
// in new projects this falls back to the template placeholder and will be replaced by the initializer
const projectName = env.APP_NAME;

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
    `https://${projectName}.vercel.app`,
    `https://${projectName}-ui.vercel.app`,
    `https://${projectName}-api.vercel.app`, // Add API domain as trusted origin
    `https://${projectName}-api.codedicated.com`,
    `https://${projectName}-ui.codedicated.com`,
  ],
  plugins: [
    twoFactor({
      issuer: env.APP_NAME,
    }),
    admin(),
    organization({
      requireEmailVerificationOnInvitation: false, // Start with false for development
      async sendInvitationEmail(data) {
        // Construct invitation acceptance URL
        const baseUrl =
          env.NODE_ENV === "production"
            ? `https://${projectName}.vercel.app`
            : "http://localhost:5173";
        const invitationUrl = `${baseUrl}/accept-invitation/${data.id}`;

        // Send invitation email
        await sendEmail({
          type: "organization-invitation",
          to: data.email,
          data: {
            invitedByUsername: data.inviter.user.name,
            invitedByEmail: data.inviter.user.email,
            organizationName: data.organization.name,
            invitationUrl,
          },
        });
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
      createCustomerOnSignUp: false,
      use: [
        checkout({
          products: [
            {
              productId: env.POLAR_BASIC_MONTHLY_PRODUCT_ID,
              slug: "basic-monthly",
            },
            {
              productId: env.POLAR_BASIC_YEARLY_PRODUCT_ID,
              slug: "basic-yearly",
            },
            {
              productId: env.POLAR_PRO_MONTHLY_PRODUCT_ID,
              slug: "pro-monthly",
            },
            {
              productId: env.POLAR_PRO_YEARLY_PRODUCT_ID,
              slug: "pro-yearly",
            },
            {
              productId: env.POLAR_ULTIMATE_MONTHLY_PRODUCT_ID,
              slug: "ultimate-monthly",
            },
            {
              productId: env.POLAR_ULTIMATE_YEARLY_PRODUCT_ID,
              slug: "ultimate-yearly",
            },
          ],
          successUrl: env.POLAR_SUCCESS_URL,
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
    // Remove crossSubDomainCookies as it won't work with separate Vercel apps
    // The proxy solution handles this instead
    cookies: {
      sessionToken: {
        attributes: {
          secure: env.NODE_ENV === "production", // Use secure cookies in production
          sameSite: "none", // Allow cookies to be sent in cross-site contexts
          httpOnly: true, // Prevent XSS attacks
        },
      },
    },
  },
});
