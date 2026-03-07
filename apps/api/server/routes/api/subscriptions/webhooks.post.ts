/**
 * Unified Webhook handler
 * Routes webhooks to the correct provider handler based on configuration
 */
import { eq } from "drizzle-orm";
import { createError, defineEventHandler, getHeader, readRawBody } from "h3";
import { db, organization, user } from "@beztack/db";
import { getPaymentProvider } from "@/lib/payments";

async function updateUserSubscription(
  userId: string,
  updates: Record<string, unknown>
): Promise<void> {
  await db.update(user).set(updates).where(eq(user.id, userId));
}

async function updateOrganizationSubscription(
  organizationId: string,
  updates: Record<string, unknown>
): Promise<void> {
  await db
    .update(organization)
    .set(updates)
    .where(eq(organization.id, organizationId));
}

async function findUserIdByEmail(
  email: string | undefined
): Promise<string | null> {
  if (!email) {
    return null;
  }

  const [matchedUser] = await db
    .select({
      id: user.id,
    })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  return matchedUser?.id ?? null;
}

export default defineEventHandler(async (event) => {
  const provider = getPaymentProvider();

  try {
    const rawBody = await readRawBody(event);
    if (!rawBody) {
      throw createError({
        statusCode: 400,
        message: "Missing request body",
      });
    }

    const signature =
      getHeader(event, "x-signature") ??
      getHeader(event, "x-polar-signature") ??
      "";

    const payload = await provider.parseWebhook(rawBody, signature);

    // Handle subscription events
    if (payload.subscription) {
      const sub = payload.subscription;
      const metadata = sub.metadata as
        | {
            userId?: string;
            organizationId?: string;
            referenceId?: string;
            tier?: string;
          }
        | undefined;

      const userId =
        metadata?.userId ?? (await findUserIdByEmail(sub.customerEmail));

      if (userId) {
        await updateUserSubscription(userId, {
          subscriptionTier: metadata?.tier ?? "pro",
          subscriptionStatus: sub.status === "active" ? "active" : sub.status,
          subscriptionId: sub.id,
          subscriptionValidUntil: sub.currentPeriodEnd ?? null,
        });
      }

      const organizationId =
        metadata?.organizationId ??
        // legacy fallback: referenceId can be userId in old MP payloads, so guard it
        (metadata?.referenceId &&
        metadata.referenceId !== metadata.userId
          ? metadata.referenceId
          : undefined);

      if (organizationId) {
        await updateOrganizationSubscription(organizationId, {
          subscriptionTier: metadata?.tier ?? "team",
          subscriptionStatus: sub.status === "active" ? "active" : sub.status,
          subscriptionId: sub.id,
          subscriptionValidUntil: sub.currentPeriodEnd ?? null,
        });
      }
    }

    return {
      success: true,
      provider: provider.provider,
      eventType: payload.type,
    };
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: Needed for webhook debugging
    console.error("Webhook error:", error);

    throw createError({
      statusCode: 500,
      message:
        error instanceof Error ? error.message : "Webhook processing failed",
    });
  }
});
