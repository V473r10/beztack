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
import {
  createPaymentEvent,
  mapPaymentStatusToEventType,
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
  const mpPayment = await mp.payments.get(paymentId);
  if (!mpPayment.id) {
    throw new Error(`Payment ${paymentId} not found`);
  }

  const id = String(mpPayment.id);
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

  const eventType = mapPaymentStatusToEventType(mpPayment.status ?? "");
  if (eventType) {
    paymentEvents.emitPaymentEvent(
      createPaymentEvent(eventType, {
        id,
        userId: beztackUserId,
        status: mpPayment.status ?? "unknown",
        amount: mpPayment.transaction_amount?.toString() ?? null,
        currency: mpPayment.currency_id ?? null,
        description: mpPayment.description ?? null,
        payerEmail: mpPayment.payer?.email ?? null,
      })
    );
  }
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
  const isOrgMode = env.SUBSCRIPTION_MODE === "organization";

  if (isOrgMode && refMeta?.organizationId) {
    await db
      .update(schema.organization)
      .set({
        subscriptionTier: tier,
        subscriptionStatus: status,
        subscriptionId: id,
        subscriptionValidUntil: nextPaymentDate,
      })
      .where(eq(schema.organization.id, refMeta.organizationId));
  } else if (!isOrgMode && beztackUserId) {
    await db
      .update(schema.user)
      .set({
        subscriptionTier: tier,
        subscriptionStatus: status,
        subscriptionId: id,
        subscriptionValidUntil: nextPaymentDate,
      })
      .where(eq(schema.user.id, beztackUserId));
  }

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
