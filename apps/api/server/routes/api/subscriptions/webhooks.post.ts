/**
 * Unified Webhook handler
 * Routes webhooks to the correct provider handler based on configuration
 */
import { eq } from "drizzle-orm";
import { createError, defineEventHandler, getHeader, readRawBody } from "h3";
import { db } from "@/db/db";
import { organization, user } from "@/db/schema";
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
        | { userId?: string; referenceId?: string; tier?: string }
        | undefined;

      if (metadata?.userId) {
        await updateUserSubscription(metadata.userId, {
          subscriptionTier: metadata.tier ?? "pro",
          subscriptionStatus: sub.status === "active" ? "active" : sub.status,
          subscriptionId: sub.id,
          subscriptionValidUntil: sub.currentPeriodEnd ?? null,
        });
      }

      if (metadata?.referenceId) {
        await updateOrganizationSubscription(metadata.referenceId, {
          subscriptionTier: metadata.tier ?? "team",
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
