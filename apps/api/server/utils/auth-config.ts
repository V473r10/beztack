import type { SendEmailUnifiedProps } from "@beztack/email";
import { type BetterAuthOptions, type BetterAuthPlugin, betterAuth } from "better-auth";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { admin, organization, twoFactor } from "better-auth/plugins";
import { adminAc, userAc } from "better-auth/plugins/admin/access";
import { isAllowlistedAppAdminEmail, isAppAdminActor } from "./app-admin";
import { resolveAllowedOrigins } from "./cors-origins";

/**
 * Everything the better-auth config needs from the outside world. `auth.ts`
 * wires the real database, env and email sender; tests pass `memoryAdapter`
 * and a fake sender, so they exercise this exact config.
 */
export type AuthConfigDeps = {
  database: BetterAuthOptions["database"];
  appName: string;
  /** Public UI URL: invitation links, trusted origin and cookie `secure`. */
  appUrl: string;
  /** Extra trusted origins, comma-separated (`CORS_ORIGINS`). */
  corsOrigins: string;
  /** Normalized `APP_ADMIN_EMAILS` allowlist. */
  appAdminEmails: string[];
  sendEmail: (props: SendEmailUnifiedProps) => Promise<unknown>;
  /** Provider plugins (e.g. Polar), appended after the core ones. */
  plugins?: BetterAuthPlugin[];
};

type SessionUserLike = { id: string; email?: string | null; role?: unknown };

function getSessionUser(session: unknown): SessionUserLike | null {
  if (!session || typeof session !== "object") {
    return null;
  }
  return (session as { user?: SessionUserLike }).user ?? null;
}

/** `https://app.example.com/` -> `https://app.example.com` (no trailing slash). */
function getAppBaseUrl(appUrl: string): string {
  return appUrl.replace(/\/+$/, "");
}

export function createAuth(deps: AuthConfigDeps) {
  const appBaseUrl = getAppBaseUrl(deps.appUrl);

  return betterAuth({
    database: deps.database,
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    socialProviders: {},
    trustedOrigins: resolveAllowedOrigins({
      corsOrigins: deps.corsOrigins,
      appUrl: deps.appUrl,
    }),
    plugins: [
      twoFactor({ issuer: deps.appName }),
      // `sudo` is the App admin role. better-auth only accepts admin roles it
      // knows, so `sudo` is registered with the admin access controls. The
      // allowlist half of App admin is enforced in `hooks.before` below.
      admin({
        defaultRole: "user",
        adminRoles: ["sudo"],
        roles: { sudo: adminAc, user: userAc },
      }),
      organization({
        requireEmailVerificationOnInvitation: false,
        async sendInvitationEmail(data) {
          await deps.sendEmail({
            type: "organization-invitation",
            to: data.email,
            data: {
              invitedByUsername: data.inviter.user.name,
              invitedByEmail: data.inviter.user.email,
              organizationName: data.organization.name,
              invitationUrl: `${appBaseUrl}/accept-invitation/${data.id}`,
            },
          });
        },
        organizationDeletion: {
          disabled: false,
        },
        teams: {
          enabled: true,
          maximumTeams: 50,
          allowRemovingAllTeams: false,
        },
      }),
      ...(deps.plugins ?? []),
    ],
    hooks: {
      // Every better-auth `/admin/*` endpoint requires an App admin: `sudo`
      // alone (without an allowlisted email) is refused here.
      before: createAuthMiddleware(async (ctx) => {
        if (!ctx.path.startsWith("/admin/")) {
          return;
        }
        const session = await getSessionFromCtx(ctx);
        if (!session) {
          // Let the endpoint answer 401 itself.
          return;
        }
        if (!isAppAdminActor(session.user, deps.appAdminEmails)) {
          throw new APIError("FORBIDDEN", { message: "App admin access required" });
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        const newSession = ctx.context.newSession;

        if (ctx.path.startsWith("/sign-up") && newSession) {
          await deps.sendEmail({
            type: "welcome",
            to: newSession.user.email,
            data: { username: newSession.user.name },
          });
        }

        // Promote an allowlisted operator to `sudo` when they sign up or in.
        const sessionUser = getSessionUser(newSession);
        if (
          sessionUser &&
          isAllowlistedAppAdminEmail(sessionUser.email, deps.appAdminEmails) &&
          !isAppAdminActor(sessionUser, deps.appAdminEmails)
        ) {
          await ctx.context.internalAdapter.updateUser(sessionUser.id, { role: "sudo" });
        }
      }),
    },
    advanced: {
      // better-auth keys this map by the cookie's own name (`session_token`).
      // The old `sessionToken` key matched nothing, so none of its attributes
      // ever applied; the live cookie has been better-auth's default
      // (`SameSite=Lax`), which the UI's same-origin proxy relies on. Only
      // `secure` is set here, so that behaviour is kept.
      cookies: {
        session_token: {
          attributes: {
            // Secure whenever the app is served over HTTPS, local or not.
            secure: new URL(deps.appUrl).protocol === "https:",
            httpOnly: true,
          },
        },
      },
    },
  });
}
