import { db, schema, user } from "@beztack/db";
import { sendEmail } from "@beztack/email";
import { createPolarAuthPlugin } from "@beztack/payments-polar/auth";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
  admin,
  createAuthMiddleware,
  organization,
  twoFactor,
} from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { env } from "@/env";
import { getPolarProductMappings } from "@/lib/payments/config";

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
    `https://app.beztack.com`
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
    ...(polarPlugin ? [polarPlugin] : []),
  ],
  after: [
    createAuthMiddleware(async (ctx) => {
      // Intercept session fetching to inject isAppAdmin dynamically
      if (ctx.path.includes("/get-session") && ctx.context.session?.user) {
        const appAdminEmails = env.APP_ADMIN_EMAILS.split(",")
          .map((e: string) => e.trim().toLowerCase())
          .filter(Boolean);

        if (appAdminEmails.includes(ctx.context.session.user.email.toLowerCase())) {
           // @ts-ignore - custom property
           ctx.context.session.user.isAppAdmin = true;
        }
      }

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

      if (ctx.path.includes("/sign-in") || ctx.path.includes("/sign-up")) {
        // @ts-ignore - better-auth types are a bit loose in hooks
        const session = ctx.context.newSession || ctx.context.session;
        if (session && session.user) {
          const appAdminEmails = env.APP_ADMIN_EMAILS.split(",")
            .map((e: string) => e.trim().toLowerCase())
            .filter(Boolean);

          if (appAdminEmails.includes(session.user.email.toLowerCase())) {
            // Mark user as app admin directly in db for backward compat
            if (session.user.role !== "sudo") {
              await db
                .update(user)
                .set({ role: "sudo" })
                .where(eq(user.id, session.user.id));
            }
            // Also update the session context directly so the frontend gets it immediately
            if (ctx.context.newSession) {
              // @ts-ignore - custom property
              ctx.context.newSession.user.isAppAdmin = true;
            } else if (ctx.context.session) {
              // @ts-ignore - custom property
              ctx.context.session.user.isAppAdmin = true;
            }
          }
        }
      }
    }),
  ],
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