/**
 * MercadoPago Webhook handler
 *
 * Receives webhooks from MercadoPago and persists data to
 * provider-agnostic tables (subscription, payment, webhookLog).
 * Also denormalizes subscription state to user/organization.
 */
import { db, schema, webhookLog } from "@beztack/db";
import { decodeExternalReference } from "@beztack/mercadopago";
import {
  createMercadoPagoClient,
  parseDate,
  type WebhookPayload,
} from "@beztack/mercadopago/server";
import { eq } from "drizzle-orm";
import { defineEventHandler, getHeader, readBody } from "h3";
import { env } from "@/env";
import { ensurePaymentProvider } from "@/lib/payments";
import {
  createPaymentEvent,
  mapSubscriptionStatusToEventType,
  paymentEvents,
} from "@/server/utils/payment-events";

const mp = createMercadoPagoClient({
  accessToken: env.MERCADO_PAGO_ACCESS_TOKEN,
  webhookSecret: env.MERCADO_PAGO_WEBHOOK_SECRET,
  integratorId: env.MERCADO_PAGO_INTEGRATOR_ID,
});

export default defineEventHandler(async (event) => {
  const body = await readBody<WebhookPayload>(event);

  const xSignature = getHeader(event, "x-signature");
  const xRequestId = getHeader(event, "x-request-id");

  if (
    !mp.webhooks.validate(xSignature ?? null, xRequestId ?? null, body.data.id)
  ) {
    return { success: false, error: "Invalid signature" };
  }

  const { type, action } = body;
  const resourceId = body.data.id;

  const [logEntry] = await db
    .insert(webhookLog)
    .values({
      provider: "mercadopago",
      eventType: `${type}.${action}`,
      resourceId,
      rawPayload: body,
      status: "received",
    })
    .returning();

  try {
    await processWebhook(type, resourceId);

    await db
      .update(webhookLog)
      .set({ status: "processed" })
      .where(eq(webhookLog.id, logEntry.id));

    return { success: true, received: body.id };
  } catch (error) {
    await db
      .update(webhookLog)
      .set({
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      })
      .where(eq(webhookLog.id, logEntry.id));

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
});

async function processWebhook(type: string, resourceId: string): Promise<void> {
  switch (type) {
    case "payment":
      await handlePayment(resourceId);
      break;
    case "subscription_preapproval":
      await handleSubscription(resourceId);
      break;
    default:
      break;
  }
}

async function handlePayment(paymentId: string): Promise<void> {
  const provider = await ensurePaymentProvider();
  const mpPayment = await mp.payments.get(paymentId);

  if (!mpPayment.id) {
    throw new Error(`Payment ${paymentId} not found`);
  }

  const id = String(mpPayment.id);
  // TODO: clear `beztack` reference on var name
  const beztackUserId = await findBeztackUserId(
    mpPayment.external_reference,
    mpPayment.payer?.email
  );

  await upsert(schema.payment, schema.payment.id, id, {
    id,
    provider: "mercadopago",
    providerPaymentId: id,
    userId: beztackUserId,
    status: mpPayment.status ?? "unknown",
    amount: String(mpPayment.transaction_amount ?? 0),
    currency: mpPayment.currency_id ?? "UYU",
    metadata: {
      payerEmail: mpPayment.payer?.email,
      externalReference: mpPayment.external_reference,
      statusDetail: mpPayment.status_detail,
    },
  });

  // After first approved payment on a prorated upgrade, adjust to full price
  if (mpPayment.status === "approved") {
    // TODO: Pasar el Full Ammount también, está en el external_reference
    const metadata = decodeExternalReference(mpPayment.external_reference);
    const subscriptionId = (
      mpPayment as {
        point_of_interaction?: {
          transaction_data?: {
            subscription_id?: string;
          };
        };
      }
    ).point_of_interaction?.transaction_data?.subscription_id;
    if (metadata?.fullAmount && subscriptionId) {
      await adjustProratedSubscriptionAmount(
        subscriptionId,
        metadata.fullAmount
      );
    }

    // Cancel the old subscription (upgrade flow)
    if (metadata?.previousSubscriptionId && !metadata.proratedDowngrade) {
      await provider.cancelSubscription(metadata.previousSubscriptionId, true);
    }

    // Downgrade: first real payment means trial ended, denormalize to new tier
    if (metadata?.proratedDowngrade && metadata.tier && subscriptionId) {
      await denormalizeSubscriptionState({
        id: subscriptionId,
        tier: metadata.tier,
        status: "authorized",
        nextPaymentDate: null,
        organizationId: metadata.organizationId,
        userId: beztackUserId,
      });
    }
  }
}

/**
 * If this payment belongs to a prorated upgrade subscription,
 * update the subscription's transaction_amount to the full new tier price.
 * This runs once after the first (discounted) payment is approved.
 */
async function adjustProratedSubscriptionAmount(
  subId: string,
  fullAmount: number
): Promise<void> {
  // Update the subscription's recurring amount to the full price
  const result = await mp.subscriptions.update(subId, {
    auto_recurring: {
      transaction_amount: fullAmount,
    },
  });

  if (result.auto_recurring?.transaction_amount !== fullAmount) {
    return;
  }
}

async function denormalizeSubscriptionState(opts: {
  id: string;
  tier: string | null;
  status: string;
  nextPaymentDate: Date | null;
  organizationId: string | undefined;
  userId: string | null;
}): Promise<void> {
  const isOrgMode = env.SUBSCRIPTION_MODE === "organization";

  const updates = {
    subscriptionTier: opts.tier,
    subscriptionStatus: opts.status,
    subscriptionId: opts.id,
    subscriptionValidUntil: opts.nextPaymentDate,
  };

  if (isOrgMode && opts.organizationId) {
    await db
      .update(schema.organization)
      .set(updates)
      .where(eq(schema.organization.id, opts.organizationId));
  } else if (!isOrgMode && opts.userId) {
    await db
      .update(schema.user)
      .set(updates)
      .where(eq(schema.user.id, opts.userId));
  }
}

async function handleDowngradeTransition(
  refMeta: ReturnType<typeof decodeExternalReference>,
  status: string,
  tier: string | null
): Promise<string | null> {
  const isDowngradeAuthorized =
    refMeta?.proratedDowngrade && status === "authorized";

  if (isDowngradeAuthorized && refMeta.previousSubscriptionId) {
    const provider = await ensurePaymentProvider();
    await provider.cancelSubscription(refMeta.previousSubscriptionId, true);
  }

  if (isDowngradeAuthorized && refMeta.previousTier) {
    return refMeta.previousTier;
  }

  return tier;
}

async function handleSubscription(subscriptionId: string): Promise<void> {
  const sub = await mp.subscriptions.get(subscriptionId);
  if (!sub.id) {
    throw new Error(`Subscription ${subscriptionId} not found`);
  }

  const id = sub.id;
  const refMeta = decodeExternalReference(sub.external_reference);
  const beztackUserId = await findBeztackUserId(
    sub.external_reference,
    sub.payer_email
  );

  await upsert(schema.subscription, schema.subscription.id, id, {
    id,
    provider: "mercadopago",
    providerSubscriptionId: id,
    userId: beztackUserId,
    organizationId: refMeta?.organizationId ?? null,
    status: sub.status ?? "unknown",
    externalReference: sub.external_reference ?? null,
    currentPeriodEnd: parseDate(sub.next_payment_date),
    metadata: {
      payerEmail: sub.payer_email,
      reason: sub.reason,
      tier: refMeta?.tier,
    },
  });

  const tier = refMeta?.tier ?? null;
  const status = sub.status ?? "unknown";
  const nextPaymentDate = parseDate(sub.next_payment_date);

  const effectiveTier = await handleDowngradeTransition(refMeta, status, tier);

  await denormalizeSubscriptionState({
    id,
    tier: effectiveTier,
    status,
    nextPaymentDate,
    organizationId: refMeta?.organizationId,
    userId: beztackUserId,
  });

  const eventType = mapSubscriptionStatusToEventType(status);
  if (eventType) {
    paymentEvents.emitPaymentEvent(
      createPaymentEvent(eventType, {
        id,
        userId: beztackUserId,
        status,
        amount: sub.auto_recurring?.transaction_amount?.toString() ?? null,
        currency: sub.auto_recurring?.currency_id ?? null,
        payerEmail: sub.payer_email ?? null,
        planId: sub.preapproval_plan_id ?? null,
        reason: sub.reason ?? null,
        nextPaymentDate: sub.next_payment_date ?? null,
      })
    );
  }
}

// biome-ignore lint/suspicious/noExplicitAny: generic upsert helper
async function upsert(table: any, idCol: any, id: string, data: any) {
  const existing = await db
    .select({ id: idCol })
    .from(table)
    .where(eq(idCol, id))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(table).values(data);
  } else {
    await db.update(table).set(data).where(eq(idCol, id));
  }
}

// TODO: clear `beztack` reference on function name
async function findBeztackUserId(
  externalReference: string | undefined | null,
  payerEmail: string | undefined | null
): Promise<string | null> {
  if (externalReference) {
    const refMeta = decodeExternalReference(externalReference);
    if (refMeta?.userId) {
      const [userByRef] = await db
        .select({ id: schema.user.id })
        .from(schema.user)
        .where(eq(schema.user.id, refMeta.userId))
        .limit(1);
      if (userByRef) {
        return userByRef.id;
      }
    }
  }

  if (payerEmail) {
    const [userByEmail] = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.email, payerEmail))
      .limit(1);
    if (userByEmail) {
      return userByEmail.id;
    }
  }

  return null;
}
