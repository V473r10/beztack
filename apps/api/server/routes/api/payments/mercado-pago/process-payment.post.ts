import { createMercadoPagoClient } from "@beztack/mercadopago/server";
import { createError, defineEventHandler, readBody } from "h3";
import { env } from "@/env";
import { auth } from "@/server/utils/auth";
import {
  createPaymentEvent,
  mapPaymentStatusToEventType,
  paymentEvents,
} from "@/server/utils/payment-events";

const mp = createMercadoPagoClient({
  accessToken: env.MERCADO_PAGO_ACCESS_TOKEN,
  integratorId: env.MERCADO_PAGO_INTEGRATOR_ID,
});

type PaymentRequestBody = {
  token: string;
  issuer_id: number;
  payment_method_id: string;
  transaction_amount: number;
  installments: number;
  description: string;
  payer: {
    email: string;
    identification?: {
      type: string;
      number: string;
    };
  };
  external_reference?: string;
};

export default defineEventHandler(async (event) => {
  const body = await readBody<PaymentRequestBody>(event);

  if (!(body.token && body.payment_method_id && body.transaction_amount)) {
    throw createError({
      statusCode: 400,
      message:
        "Missing required fields: token, payment_method_id, or transaction_amount",
    });
  }

  // Get authenticated user if available
  const session = await auth.api.getSession({ headers: event.headers });
  const userId = session?.user?.id ?? null;

  try {
    const response = await mp.payments.create({
      token: body.token,
      issuer_id: String(body.issuer_id),
      payment_method_id: body.payment_method_id,
      transaction_amount: body.transaction_amount,
      installments: body.installments,
      description: body.description,
      payer: {
        email: body.payer.email,
        identification: body.payer.identification,
      },
    });

    // Emit real-time event for immediate UI feedback
    // (Webhook will also emit, but this provides instant feedback)
    const eventType = mapPaymentStatusToEventType(response.status);
    if (eventType) {
      // biome-ignore lint/suspicious/noConsole: Payment debugging
      console.log("[Process Payment] Emitting event:", {
        type: eventType,
        paymentId: response.id,
        status: response.status,
        userId,
      });

      paymentEvents.emitPaymentEvent(
        createPaymentEvent(eventType, {
          id: String(response.id),
          userId,
          status: response.status,
          amount: String(body.transaction_amount),
          currency: "UYU",
          description: body.description,
          payerEmail: body.payer.email,
        })
      );
    }

    return {
      id: response.id,
      status: response.status,
      status_detail: response.status_detail,
      date_approved: response.date_approved,
    };
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: Needed for debugging MP errors
    console.error("Mercado Pago payment error:", error);

    throw createError({
      statusCode: 500,
      message:
        error instanceof Error
          ? error.message
          : "Unknown error processing payment",
    });
  }
});
