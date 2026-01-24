import { eq, type InferSelectModel } from "drizzle-orm";
import { defineEventHandler, readBody } from "h3";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { db } from "@/db/db";
import { schema } from "@/db/schema";
import { env } from "@/env";

const client = new MercadoPagoConfig({
  accessToken: env.MERCADO_PAGO_ACCESS_TOKEN,
});

type WebhookPayload = {
  id: number;
  live_mode: boolean;
  type: string;
  date_created: string;
  user_id: number;
  api_version: string;
  action: string;
  data: {
    id: string;
  };
};

type WebhookPayloadCamelCase = {
  id: number;
  liveMode: boolean;
  type: string;
  dateCreated: string;
  userId: number;
  apiVersion: string;
  action: string;
  data: {
    id: string;
  };
};

type PaymentStatus =
  | "pending"
  | "approved"
  | "authorized"
  | "in_process"
  | "in_mediation"
  | "rejected"
  | "cancelled"
  | "refunded"
  | "charged_back";

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<WebhookPayload>(event);

    // biome-ignore lint/suspicious/noConsole: Webhook logging for debugging
    console.log("[MP Webhook] Received:", JSON.stringify(body, null, 2));

    const { type, action } = body;
    const resourceId = body.data.id;

    // Handle different webhook types
    switch (type) {
      case "order": {
        const order = snakeCaseToCamelCase(
          body
        ) as unknown as WebhookPayloadCamelCase;
        console.log("[MP Webhook] Order:", order);
        const orderData = order.data as InferSelectModel<typeof schema.mpOrder>;
        console.log("[MP Webhook] Order data:", orderData);
        const existingOrder = await db
          .select()
          .from(schema.mpOrder)
          .where(eq(schema.mpOrder.id, resourceId));

        if (existingOrder.length === 0) {
          await db.insert(schema.mpOrder).values({
            id: resourceId,
            status: orderData.status as string,
            statusDetail: orderData.statusDetail as string,
            totalPaidAmount: orderData.totalPaidAmount as string,
            dateCreated: new Date(order.dateCreated),
            userId: String(order.userId),
            externalReference: orderData.externalReference as string,
          });
        } else {
          await db
            .update(schema.mpOrder)
            .set({
              status: orderData.status as string,
              statusDetail: orderData.statusDetail as string,
              totalPaidAmount: orderData.totalPaidAmount as string,
              dateCreated: new Date(order.dateCreated),
              userId: String(order.userId),
              externalReference: orderData.externalReference as string,
            })
            .where(eq(schema.mpOrder.id, resourceId));
        }

        break;
      }
      case "payment": {
        const paymentApi = new Payment(client);
        const paymentData = await paymentApi.get({ id: resourceId });

        // biome-ignore lint/suspicious/noConsole: Webhook logging
        console.log("[MP Webhook] Payment data:", {
          id: paymentData.id,
          status: paymentData.status,
          status_detail: paymentData.status_detail,
          transaction_amount: paymentData.transaction_amount,
          external_reference: paymentData.external_reference,
          metadata: paymentData.metadata,
        });

        // Handle specific payment statuses
        const status = paymentData.status as PaymentStatus;
        switch (status) {
          case "approved":
            // TODO: Activate user premium, send confirmation email, etc.
            // biome-ignore lint/suspicious/noConsole: Webhook logging
            console.log("[MP Webhook] Payment approved:", paymentData.id);
            break;
          case "rejected":
            // TODO: Notify user of failed payment
            // biome-ignore lint/suspicious/noConsole: Webhook logging
            console.log("[MP Webhook] Payment rejected:", paymentData.id);
            break;
          case "refunded":
            // TODO: Handle refund logic
            // biome-ignore lint/suspicious/noConsole: Webhook logging
            console.log("[MP Webhook] Payment refunded:", paymentData.id);
            break;
          case "charged_back":
            // TODO: Handle chargeback
            // biome-ignore lint/suspicious/noConsole: Webhook logging
            console.log("[MP Webhook] Chargeback received:", paymentData.id);
            break;
          default:
            // biome-ignore lint/suspicious/noConsole: Webhook logging
            console.log("[MP Webhook] Payment status:", status, paymentData.id);
        }
        break;
      }

      case "subscription_preapproval": {
        // Subscription authorization event
        // biome-ignore lint/suspicious/noConsole: Webhook logging
        console.log("[MP Webhook] Subscription preapproval:", resourceId);

        // TODO: Fetch subscription details and update database
        // const subscriptionData = await fetch(
        //   `https://api.mercadopago.com/preapproval/${resourceId}`,
        //   { headers: { Authorization: `Bearer ${env.MERCADO_PAGO_ACCESS_TOKEN}` } }
        // ).then(r => r.json());
        break;
      }

      case "subscription_authorized_payment": {
        // Recurring payment for subscription
        // biome-ignore lint/suspicious/noConsole: Webhook logging
        console.log("[MP Webhook] Subscription payment:", resourceId);
        break;
      }

      default:
        // biome-ignore lint/suspicious/noConsole: Webhook logging
        console.log("[MP Webhook] Unhandled type:", type, action, resourceId);
    }

    // Always return 200 to acknowledge receipt
    return { success: true, received: body.id };
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: Error logging
    console.error("[MP Webhook] Error:", error);

    // Still return 200 to prevent Mercado Pago from retrying
    // Log the error for debugging but don't fail the webhook
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
});

const snakeCaseToCamelCase = <T>(obj: T): T => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item: unknown) => snakeCaseToCamelCase(item)) as T;
  }

  if (typeof obj !== "object") {
    return obj;
  }

  return Object.fromEntries(
    Object.entries(obj as Record<string, unknown>).map(([key, value]) => [
      key.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase()),
      snakeCaseToCamelCase(value),
    ])
  ) as T;
};
