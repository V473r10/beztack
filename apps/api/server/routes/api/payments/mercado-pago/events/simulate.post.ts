import { createError, defineEventHandler, readBody } from "h3";
import {
  createPaymentEvent,
  type PaymentEventType,
  paymentEvents,
} from "@/server/utils/payment-events";

type SimulateEventBody = {
  type: PaymentEventType;
  data?: {
    id?: string;
    userId?: string;
    status?: string;
    amount?: string;
    currency?: string;
    description?: string;
    payerEmail?: string;
    planId?: string;
    reason?: string;
  };
};

/**
 * Test endpoint to simulate payment events for development.
 * Only available in development mode.
 *
 * POST /api/payments/mercado-pago/events/simulate
 *
 * Body:
 * {
 *   "type": "payment.approved",
 *   "data": {
 *     "id": "12345",
 *     "amount": "1000",
 *     "currency": "UYU",
 *     "description": "Test payment"
 *   }
 * }
 */
export default defineEventHandler(async (event) => {
  // Only allow in development
  if (process.env.NODE_ENV === "production") {
    throw createError({
      statusCode: 404,
      message: "Not found",
    });
  }

  const body = await readBody<SimulateEventBody>(event);

  if (!body.type) {
    throw createError({
      statusCode: 400,
      message: "Missing required field: type",
    });
  }

  const eventData = {
    id: body.data?.id ?? `test-${Date.now()}`,
    userId: body.data?.userId ?? null,
    status: body.data?.status ?? "approved",
    amount: body.data?.amount ?? "1000",
    currency: body.data?.currency ?? "UYU",
    description: body.data?.description ?? "Test event",
    payerEmail: body.data?.payerEmail ?? "test@example.com",
    planId: body.data?.planId ?? null,
    reason: body.data?.reason ?? null,
    nextPaymentDate: null,
  };

  const paymentEvent = createPaymentEvent(body.type, eventData);

  paymentEvents.emitPaymentEvent(paymentEvent);

  return {
    success: true,
    event: paymentEvent,
  };
});
