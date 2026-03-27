/**
 * Unified Webhook handler
 * Routes webhooks to the correct provider handler based on configuration.
 * Persists events to webhookLog and denormalizes subscription state.
 */

import {
  db,
  organization,
  subscription as subscriptionTable,
  user,
  webhookLog,
} from "@beztack/db";
import { eq } from "drizzle-orm";
import { createError, defineEventHandler, getHeader, readRawBody } from "h3";
import { ensurePaymentProvider } from "@/lib/payments";

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
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  return matchedUser?.id ?? null;
}

export default defineEventHandler(async (event) => {
  const provider = await ensurePaymentProvider();

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

    // Log the webhook event
    const [logEntry] = await db
      .insert(webhookLog)
      .values({
        provider: provider.provider,
        eventType: payload.type,
        resourceId: payload.subscription?.id,
        rawPayload: payload.rawPayload,
        status: "received",
      })
      .returning();

    try {
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

        // Persist subscription to generic table
        const existing = await db
          .select({ id: subscriptionTable.id })
          .from(subscriptionTable)
          .where(eq(subscriptionTable.id, sub.id))
          .limit(1);

        const subscriptionData = {
          id: sub.id,
          provider: provider.provider,
          providerSubscriptionId: sub.id,
          userId,
          organizationId: metadata?.organizationId ?? null,
          status: sub.status,
          currentPeriodStart: sub.currentPeriodStart ?? null,
          currentPeriodEnd: sub.currentPeriodEnd ?? null,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd ?? null,
          metadata: sub.metadata ?? null,
        };

        if (existing.length === 0) {
          await db.insert(subscriptionTable).values(subscriptionData);
        } else {
          await db
            .update(subscriptionTable)
            .set(subscriptionData)
            .where(eq(subscriptionTable.id, sub.id));
        }

        // Denormalize to user
        if (userId) {
          await updateUserSubscription(userId, {
            subscriptionTier: metadata?.tier ?? "pro",
            subscriptionStatus: sub.status === "active" ? "active" : sub.status,
            subscriptionId: sub.id,
            subscriptionValidUntil: sub.currentPeriodEnd ?? null,
          });
        }

        // Denormalize to organization
        const organizationId =
          metadata?.organizationId ??
          (metadata?.referenceId && metadata.referenceId !== metadata.userId
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

      // Mark webhook as processed
      await db
        .update(webhookLog)
        .set({ status: "processed" })
        .where(eq(webhookLog.id, logEntry.id));
    } catch (processingError) {
      await db
        .update(webhookLog)
        .set({
          status: "failed",
          errorMessage:
            processingError instanceof Error
              ? processingError.message
              : "Unknown error",
        })
        .where(eq(webhookLog.id, logEntry.id));
      throw processingError;
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
