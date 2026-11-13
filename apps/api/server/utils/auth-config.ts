import type { SendEmailUnifiedProps } from "@beztack/email";
import { type BetterAuthOptions, type BetterAuthPlugin, betterAuth } from "better-auth";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { admin, organization, twoFactor } from "better-auth/plugins";
import { adminAc, userAc } from "better-auth/plugins/admin/access";
import {
  isAllowlistedAppAdminEmail,
  isAppAdminActor,
} from "../domain/organization-access/implementation";
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
  /**
   * Give every new user a Personal organization (they own it) at sign-up.
   * Off by default so a caller that does not opt in creates nothing.
   */
  personalOrganizationOnSignup?: boolean;
};

/** The slice of the finished instance that the database hooks call. */
type AuthInstanceSlice = {
  api: {
    createOrganization(input: {
      body: { name: string; slug: string; userId: string };
    }): Promise<{ id: string } | null>;
  };
  $context: Promise<{
    adapter: {
      findMany<T>(input: {
        model: string;
        where: { field: string; value: string }[];
        sortBy: { field: string; direction: "asc" | "desc" };
        limit: number;
      }): Promise<T[]>;
      updateMany(input: {
        model: string;
        where: { field: string; value: string }[];
        update: Record<string, unknown>;
      }): Promise<number>;
    };
  }>;
};

type SessionUserLike = { id: string; email?: string | null; role?: unknown };

function getSessionUser(session: unknown): SessionUserLike | null {
  if (!session || typeof session !== "object") {
    return null;
  }
  return (session as { user?: SessionUserLike }).user ?? null;
}

const PERSONAL_ORGANIZATION_CREATE_ATTEMPTS = 3;

/** Lowercase ASCII words joined by `-`; empty when nothing usable is left. */
function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function randomSuffix(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8);
}

/** `https://app.example.com/` -> `https://app.example.com` (no trailing slash). */
function getAppBaseUrl(appUrl: string): string {
  return appUrl.replace(/\/+$/, "");
}

export function createAuth(deps: AuthConfigDeps) {
  const appBaseUrl = getAppBaseUrl(deps.appUrl);

  // The database hooks below run inside `betterAuth()`, so they reach the
  // finished instance through this reference, which is set before any request.
  let instance: AuthInstanceSlice | undefined;

  async function activateOrganization(userId: string, organizationId: string): Promise<void> {
    const current = instance;
    if (!current) {
      return;
    }
    const { adapter } = await current.$context;
    await adapter.updateMany({
      model: "session",
      where: [{ field: "userId", value: userId }],
      update: { activeOrganizationId: organizationId },
    });
  }

  async function createPersonalOrganization(user: { id: string; name: string }): Promise<void> {
    const current = instance;
    if (!current) {
      return;
    }
    const baseName = user.name.trim() || "Personal";
    const baseSlug = slugify(baseName) || "personal";
    let lastError: unknown;
    for (let attempt = 0; attempt < PERSONAL_ORGANIZATION_CREATE_ATTEMPTS; attempt += 1) {
      try {
        const organization = await current.api.createOrganization({
          body: {
            name: `${baseName}'s organization`,
            slug: `${baseSlug}-${randomSuffix()}`,
            userId: user.id,
          },
        });
        // better-auth runs this hook after the sign-up session already
        // exists, so that session needs the new Organization activated.
        if (organization?.id) {
          await activateOrganization(user.id, organization.id);
        }
        return;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }

  async function findOldestOrganizationId(userId: string): Promise<string | null> {
    const current = instance;
    if (!current) {
      return null;
    }
    const { adapter } = await current.$context;
    const [oldest] = await adapter.findMany<{ organizationId: string }>({
      model: "member",
      where: [{ field: "userId", value: userId }],
      sortBy: { field: "createdAt", direction: "asc" },
      limit: 1,
    });
    return oldest?.organizationId ?? null;
  }

  const auth = betterAuth({
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
    databaseHooks: {
      user: {
        create: {
          // Best effort: a failure here must not undo the sign-up. A user
          // without an Organization is told to create one when they pay.
          after: async (user) => {
            if (!deps.personalOrganizationOnSignup) {
              return;
            }
            try {
              await createPersonalOrganization(user);
            } catch (error) {
              console.error("Could not create the Personal organization", error);
            }
          },
        },
      },
      session: {
        create: {
          // Every new session starts in the user's oldest Organization.
          before: async (session) => {
            if (session.activeOrganizationId) {
              return;
            }
            const activeOrganizationId = await findOldestOrganizationId(session.userId);
            if (!activeOrganizationId) {
              return;
            }
            return { data: { ...session, activeOrganizationId } };
          },
        },
      },
    },
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

  instance = auth as unknown as AuthInstanceSlice;
  return auth;
}
