import { eq } from "drizzle-orm";
import { defineEventHandler, getHeader, readBody } from "h3";
import { db } from "@/db/db";
import { schema } from "@/db/schema";
import {
  fetchChargeback,
  fetchInvoice,
  fetchMerchantOrder,
  fetchPayment,
  fetchSubscription,
  type MPChargebackResponse,
  type MPInvoiceResponse,
  type MPMerchantOrderResponse,
  type MPPaymentResponse,
  type MPSubscriptionResponse,
  parseDate,
  toStringId,
  validateWebhookSignature,
  type WebhookPayload,
} from "@/server/utils/mercadopago";

// =============================================================================
// Webhook Handler
// =============================================================================

export default defineEventHandler(async (event) => {
  const body = await readBody<WebhookPayload>(event);

  const xSignature = getHeader(event, "x-signature");
  const xRequestId = getHeader(event, "x-request-id");

  if (
    !validateWebhookSignature(
      xSignature ?? null,
      xRequestId ?? null,
      body.data.id
    )
  ) {
    // biome-ignore lint/suspicious/noConsole: Security logging
    console.error("[MP Webhook] Invalid signature");
    return { success: false, error: "Invalid signature" };
  }

  const { type, action } = body;
  const resourceId = body.data.id;

  const [webhookLog] = await db
    .insert(schema.mpWebhookLog)
    .values({
      webhookId: toStringId(body.id),
      type,
      action,
      resourceId,
      liveMode: body.live_mode,
      mpUserId: toStringId(body.user_id),
      apiVersion: body.api_version,
      rawPayload: JSON.stringify(body),
      status: "received",
    })
    .returning();

  try {
    await processWebhook(type, action, resourceId);

    await db
      .update(schema.mpWebhookLog)
      .set({ status: "processed" })
      .where(eq(schema.mpWebhookLog.id, webhookLog.id));

    return { success: true, received: body.id };
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: Error logging
    console.error("[MP Webhook] Error processing:", error);

    await db
      .update(schema.mpWebhookLog)
      .set({
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      })
      .where(eq(schema.mpWebhookLog.id, webhookLog.id));

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
});

async function processWebhook(
  type: string,
  action: string,
  resourceId: string
): Promise<void> {
  switch (type) {
    case "payment":
      await handlePayment(resourceId);
      break;
    case "merchant_order":
      await handleMerchantOrder(resourceId);
      break;
    case "subscription_preapproval":
      await handleSubscription(resourceId);
      break;
    case "subscription_authorized_payment":
      await handleInvoice(resourceId);
      break;
    case "chargebacks":
      await handleChargeback(resourceId);
      break;
    default:
      // biome-ignore lint/suspicious/noConsole: Webhook logging
      console.log("[MP Webhook] Unhandled type:", type, action, resourceId);
  }
}

// =============================================================================
// Handler Functions
// =============================================================================

async function handlePayment(paymentId: string): Promise<void> {
  const payment = await fetchPayment(paymentId);
  if (!payment.id) {
    throw new Error(`Payment ${paymentId} not found`);
  }

  const id = String(payment.id);
  const beztackUserId = await findBeztackUserId(
    payment.external_reference,
    payment.payer?.email
  );

  const data = mapPaymentData(id, payment, beztackUserId);
  await upsertPayment(id, data);

  if (payment.refunds && payment.refunds.length > 0) {
    await syncRefunds(id, payment.refunds);
  }

  // biome-ignore lint/suspicious/noConsole: Webhook logging
  console.log(`[MP Webhook] Payment ${id} - ${payment.status}`);
}

async function handleMerchantOrder(orderId: string): Promise<void> {
  const order = await fetchMerchantOrder(orderId);
  if (!order.id) {
    throw new Error(`Order ${orderId} not found`);
  }

  const id = String(order.id);
  const data = mapOrderData(id, order);
  await upsertOrder(id, data);

  // biome-ignore lint/suspicious/noConsole: Webhook logging
  console.log(`[MP Webhook] Order ${id} - ${order.status}`);
}

async function handleSubscription(subscriptionId: string): Promise<void> {
  const subscription = await fetchSubscription(subscriptionId);
  if (!subscription.id) {
    throw new Error(`Subscription ${subscriptionId} not found`);
  }

  const id = subscription.id;
  const beztackUserId = await findBeztackUserId(
    subscription.external_reference,
    subscription.payer_email
  );

  const data = mapSubscriptionData(id, subscription, beztackUserId);
  await upsertSubscription(id, data);

  // biome-ignore lint/suspicious/noConsole: Webhook logging
  console.log(`[MP Webhook] Subscription ${id} - ${subscription.status}`);
}

async function handleInvoice(invoiceId: string): Promise<void> {
  const invoice = await fetchInvoice(invoiceId);
  if (!invoice.id) {
    throw new Error(`Invoice ${invoiceId} not found`);
  }

  const id = invoice.id;
  const data = mapInvoiceData(id, invoice);
  await upsertInvoice(id, data);

  // biome-ignore lint/suspicious/noConsole: Webhook logging
  console.log(`[MP Webhook] Invoice ${id} - ${invoice.status}`);
}

async function handleChargeback(chargebackId: string): Promise<void> {
  const chargeback = await fetchChargeback(chargebackId);
  if (!chargeback.id) {
    throw new Error(`Chargeback ${chargebackId} not found`);
  }

  const id = chargeback.id;
  const data = mapChargebackData(id, chargeback);
  await upsertChargeback(id, data);

  // biome-ignore lint/suspicious/noConsole: Webhook logging
  console.log(`[MP Webhook] Chargeback ${id} - ${chargeback.status}`);
}

// =============================================================================
// Data Mappers
// =============================================================================

// Helper to convert number to string or return null
const numStr = (n: number | undefined | null): string | null =>
  n != null ? String(n) : null;

// Helper for nullable string
const str = (s: string | undefined | null): string | null => s ?? null;

function mapPaymentData(
  id: string,
  p: MPPaymentResponse,
  beztackUserId: string | null
) {
  return {
    id,
    beztackUserId,
    orderId: p.order?.id ? String(p.order.id) : null,
    externalReference: str(p.external_reference),
    status: p.status ?? "unknown",
    statusDetail: str(p.status_detail),
    operationType: str(p.operation_type),
    paymentMethodId: str(p.payment_method_id),
    paymentTypeId: str(p.payment_type_id),
    issuerId: str(p.issuer_id),
    transactionAmount: numStr(p.transaction_amount),
    transactionAmountRefunded: numStr(p.transaction_amount_refunded),
    netReceivedAmount: numStr(p.transaction_details?.net_received_amount),
    currencyId: str(p.currency_id),
    installments: p.installments ?? null,
    payerId: toStringId(p.payer?.id),
    payerEmail: str(p.payer?.email),
    collectorId: toStringId(p.collector_id),
    description: str(p.description),
    statementDescriptor: str(p.statement_descriptor),
    cardFirstSixDigits: str(p.card?.first_six_digits),
    cardLastFourDigits: str(p.card?.last_four_digits),
    liveMode: p.live_mode ?? null,
    dateCreated: parseDate(p.date_created),
    dateApproved: parseDate(p.date_approved),
    dateLastUpdated: parseDate(p.date_last_updated),
    moneyReleaseDate: parseDate(p.money_release_date),
  };
}

function mapOrderData(id: string, o: MPMerchantOrderResponse) {
  return {
    id,
    preferenceId: str(o.preference_id),
    applicationId: str(o.application_id),
    externalReference: str(o.external_reference),
    status: o.status ?? "unknown",
    orderStatus: str(o.order_status),
    siteId: str(o.site_id),
    payerId: toStringId(o.payer?.id),
    collectorId: toStringId(o.collector?.id),
    paidAmount: numStr(o.paid_amount),
    refundedAmount: numStr(o.refunded_amount),
    shippingCost: numStr(o.shipping_cost),
    totalAmount: numStr(o.total_amount),
    cancelled: o.cancelled ?? false,
    notificationUrl: str(o.notification_url),
    additionalInfo: str(o.additional_info),
    isTest: o.is_test ?? false,
    dateCreated: parseDate(o.date_created),
    lastUpdated: parseDate(o.last_updated),
  };
}

function mapSubscriptionData(
  id: string,
  s: MPSubscriptionResponse,
  beztackUserId: string | null
) {
  return {
    id,
    beztackUserId,
    preapprovalPlanId: str(s.preapproval_plan_id),
    externalReference: str(s.external_reference),
    payerId: toStringId(s.payer_id),
    payerEmail: str(s.payer_email),
    collectorId: toStringId(s.collector_id),
    applicationId: toStringId(s.application_id),
    status: s.status ?? "unknown",
    reason: str(s.reason),
    initPoint: str(s.init_point),
    backUrl: str(s.back_url),
    frequency: s.auto_recurring?.frequency ?? null,
    frequencyType: str(s.auto_recurring?.frequency_type),
    transactionAmount: numStr(s.auto_recurring?.transaction_amount),
    currencyId: str(s.auto_recurring?.currency_id),
    chargedQuantity: s.summarized?.charged_quantity ?? null,
    chargedAmount: numStr(s.summarized?.charged_amount),
    pendingChargeAmount: numStr(s.summarized?.pending_charge_amount),
    nextPaymentDate: parseDate(s.next_payment_date),
    paymentMethodId: str(s.payment_method_id),
    dateCreated: parseDate(s.date_created),
    lastModified: parseDate(s.last_modified),
  };
}

function mapInvoiceData(id: string, i: MPInvoiceResponse) {
  return {
    id,
    subscriptionId: str(i.preapproval_id),
    paymentId: str(i.payment?.id),
    externalReference: str(i.external_reference),
    status: i.status ?? "unknown",
    reason: str(i.reason),
    transactionAmount: numStr(i.transaction_amount),
    currencyId: str(i.currency_id),
    payerId: toStringId(i.payer_id),
    type: str(i.type),
    retryAttempt: i.retry_attempt ?? null,
    debitDate: parseDate(i.debit_date),
    dateCreated: parseDate(i.date_created),
    lastModified: parseDate(i.last_modified),
  };
}

function mapChargebackData(id: string, c: MPChargebackResponse) {
  const paymentId =
    c.payments && c.payments.length > 0 ? String(c.payments[0]) : null;

  return {
    id,
    paymentId,
    amount: numStr(c.amount),
    coverageApplied: c.coverage_applied ?? null,
    coverageEligible: c.coverage_eligible ?? null,
    status: c.status ?? "unknown",
    stage: str(c.stage),
    reason: str(c.reason?.code),
    reasonDetail: str(c.reason?.description),
    documentationRequired: c.documentation_required ?? null,
    documentationStatus: str(c.documentation_status),
    resolution: str(c.resolution),
    dateCreated: parseDate(c.date_created),
    dateLastUpdated: parseDate(c.date_last_updated),
    dateDocumentationDeadline: parseDate(c.date_documentation_deadline),
  };
}

// =============================================================================
// Upsert Functions
// =============================================================================

async function upsertPayment(
  id: string,
  data: ReturnType<typeof mapPaymentData>
): Promise<void> {
  const existing = await db
    .select({ id: schema.mpPayment.id })
    .from(schema.mpPayment)
    .where(eq(schema.mpPayment.id, id))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(schema.mpPayment).values(data);
  } else {
    await db
      .update(schema.mpPayment)
      .set(data)
      .where(eq(schema.mpPayment.id, id));
  }
}

async function upsertOrder(
  id: string,
  data: ReturnType<typeof mapOrderData>
): Promise<void> {
  const existing = await db
    .select({ id: schema.mpOrder.id })
    .from(schema.mpOrder)
    .where(eq(schema.mpOrder.id, id))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(schema.mpOrder).values(data);
  } else {
    await db.update(schema.mpOrder).set(data).where(eq(schema.mpOrder.id, id));
  }
}

async function upsertSubscription(
  id: string,
  data: ReturnType<typeof mapSubscriptionData>
): Promise<void> {
  const existing = await db
    .select({ id: schema.mpSubscription.id })
    .from(schema.mpSubscription)
    .where(eq(schema.mpSubscription.id, id))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(schema.mpSubscription).values(data);
  } else {
    await db
      .update(schema.mpSubscription)
      .set(data)
      .where(eq(schema.mpSubscription.id, id));
  }
}

async function upsertInvoice(
  id: string,
  data: ReturnType<typeof mapInvoiceData>
): Promise<void> {
  const existing = await db
    .select({ id: schema.mpInvoice.id })
    .from(schema.mpInvoice)
    .where(eq(schema.mpInvoice.id, id))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(schema.mpInvoice).values(data);
  } else {
    await db
      .update(schema.mpInvoice)
      .set(data)
      .where(eq(schema.mpInvoice.id, id));
  }
}

async function upsertChargeback(
  id: string,
  data: ReturnType<typeof mapChargebackData>
): Promise<void> {
  const existing = await db
    .select({ id: schema.mpChargeback.id })
    .from(schema.mpChargeback)
    .where(eq(schema.mpChargeback.id, id))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(schema.mpChargeback).values(data);
  } else {
    await db
      .update(schema.mpChargeback)
      .set(data)
      .where(eq(schema.mpChargeback.id, id));
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

type RefundData = {
  id?: number;
  amount?: number;
  status?: string;
  reason?: string;
  date_created?: string;
  unique_sequence_number?: string;
  refund_mode?: string;
  adjustment_amount?: number;
  amount_refunded_to_payer?: number;
  source?: {
    id?: string;
    name?: string;
    type?: string;
  };
};

async function syncRefunds(
  paymentId: string,
  refunds: RefundData[]
): Promise<void> {
  for (const refund of refunds) {
    if (!refund.id) {
      continue;
    }

    const id = String(refund.id);

    const existing = await db
      .select({ id: schema.mpRefund.id })
      .from(schema.mpRefund)
      .where(eq(schema.mpRefund.id, id))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(schema.mpRefund).values({
        id,
        paymentId,
        amount: refund.amount?.toString() ?? null,
        amountRefundedToPayer:
          refund.amount_refunded_to_payer?.toString() ?? null,
        adjustmentAmount: refund.adjustment_amount?.toString() ?? null,
        status: refund.status ?? null,
        reason: refund.reason ?? null,
        refundMode: refund.refund_mode ?? null,
        sourceId: refund.source?.id ?? null,
        sourceName: refund.source?.name ?? null,
        sourceType: refund.source?.type ?? null,
        uniqueSequenceNumber: refund.unique_sequence_number ?? null,
        dateCreated: parseDate(refund.date_created),
      });
      // biome-ignore lint/suspicious/noConsole: Webhook logging
      console.log(`[MP Webhook] Refund ${id} created for payment ${paymentId}`);
    }
  }
}

async function findBeztackUserId(
  externalReference: string | undefined | null,
  payerEmail: string | undefined | null
): Promise<string | null> {
  if (externalReference) {
    const userByRef = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.id, externalReference))
      .limit(1);

    if (userByRef.length > 0) {
      return userByRef[0].id;
    }
  }

  if (payerEmail) {
    const userByEmail = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.email, payerEmail))
      .limit(1);

    if (userByEmail.length > 0) {
      return userByEmail[0].id;
    }
  }

  return null;
}
