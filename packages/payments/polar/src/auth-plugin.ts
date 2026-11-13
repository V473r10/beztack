/**
 * Polar Better Auth server plugin wrapper
 *
 * Wraps @polar-sh/better-auth so that apps/api never imports Polar directly.
 */
import { checkout, polar, portal, usage } from "@polar-sh/better-auth";
import { createPolarCore } from "@polar-sh/sdk/2026-10";

export type PolarAuthPluginConfig = {
  accessToken: string;
  server: "sandbox" | "production";
  createCustomerOnSignUp?: boolean;
  getCustomerCreateParams?: (data: {
    user: { id?: string; email?: string; name?: string };
  }) => Promise<{
    metadata?: Record<string, string | number | boolean>;
  }>;
  products: Array<{ productId: string; slug: string }>;
  successUrl: string;
  authenticatedUsersOnly?: boolean;
};

/**
 * Create the Polar Better Auth server plugin.
 * Returns null if config is missing or provider is not polar.
 */
export function createPolarAuthPlugin(config: PolarAuthPluginConfig): ReturnType<typeof polar> {
  const client = createPolarCore({
    accessToken: config.accessToken,
    environment: config.server,
  });

  const plugin = polar({
    client,
    createCustomerOnSignUp: config.createCustomerOnSignUp ?? false,
    getCustomerCreateParams: config.getCustomerCreateParams,
    use: [
      checkout({
        products: config.products,
        successUrl: config.successUrl,
        authenticatedUsersOnly: config.authenticatedUsersOnly ?? true,
      }),
      portal(),
      usage(),
    ],
  });

  return withBestEffortCustomerCreation(plugin);
}

type UserCreateAfter = (user: unknown, context: unknown) => Promise<void> | void;

type BetterAuthLoggerLike = Record<"info" | "warn", ((message: string) => void) | undefined>;

const CONFLICT_STATUS = 409;
const EMAIL_IN_TEXT = /[^\s@"'<>]+@[^\s@"'<>]+/g;

function describeFailure(error: unknown): { conflict: boolean; detail: string } {
  const status =
    error && typeof error === "object" && "statusCode" in error
      ? (error as { statusCode?: unknown }).statusCode
      : undefined;
  const code =
    error && typeof error === "object" && "status" in error
      ? (error as { status?: unknown }).status
      : undefined;
  const message = error instanceof Error ? error.message : String(error);

  return {
    conflict: status === CONFLICT_STATUS || code === "CONFLICT",
    // Provider errors echo the rejected email back; never log it in clear.
    detail: message.replace(EMAIL_IN_TEXT, "[email]"),
  };
}

/**
 * Polar's `create.after` user hook turns any customer error into a 500 after
 * better-auth already wrote the user, account and session. Creating the
 * customer is best effort: the failure is logged (without the email) and
 * sign-up succeeds. The checkout route creates the customer when it is missing.
 * A CONFLICT means the customer already exists, which is what we want.
 */
function withBestEffortCustomerCreation(
  plugin: ReturnType<typeof polar>,
): ReturnType<typeof polar> {
  const originalInit = plugin.init;
  if (!originalInit) {
    return plugin;
  }

  return {
    ...plugin,
    init(...args: Parameters<typeof originalInit>) {
      const result = originalInit(...args);
      const create = (
        result?.options?.databaseHooks?.user as { create?: { after?: UserCreateAfter } } | undefined
      )?.create;
      const original = create?.after;
      if (!(create && original)) {
        return result;
      }

      create.after = async (user, context) => {
        try {
          await original(user, context);
        } catch (error) {
          const { conflict, detail } = describeFailure(error);
          const userId = (user as { id?: string } | null)?.id ?? "unknown";
          const logger = (context as { context?: { logger?: BetterAuthLoggerLike } } | null)
            ?.context?.logger;
          const message = conflict
            ? `Polar customer already exists for user ${userId}, reusing it`
            : `Polar customer creation failed at sign-up for user ${userId}; it will be created at checkout. ${detail}`;
          (logger?.warn ?? console.warn)(message);
        }
      };
      return result;
    },
  };
}
