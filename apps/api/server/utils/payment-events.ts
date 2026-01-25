import { EventEmitter } from "node:events";

// =============================================================================
// Payment Event Types
// =============================================================================

export type PaymentEventType =
  | "payment.approved"
  | "payment.rejected"
  | "payment.pending"
  | "payment.refunded"
  | "subscription.authorized"
  | "subscription.active"
  | "subscription.paused"
  | "subscription.cancelled"
  | "invoice.processed"
  | "invoice.failed"
  | "chargeback.created";

export type PaymentEvent = {
  type: PaymentEventType;
  timestamp: string;
  data: {
    id: string;
    userId?: string | null;
    status: string;
    amount?: string | null;
    currency?: string | null;
    description?: string | null;
    payerEmail?: string | null;
    // Additional fields for subscriptions
    planId?: string | null;
    reason?: string | null;
    nextPaymentDate?: string | null;
  };
};

// =============================================================================
// Event Emitter Singleton
// =============================================================================

const MAX_SSE_CONNECTIONS = 100;

class PaymentEventEmitter extends EventEmitter {
  private static instance: PaymentEventEmitter;

  private constructor() {
    super();
    // Increase max listeners for many concurrent SSE connections
    this.setMaxListeners(MAX_SSE_CONNECTIONS);
  }

  static getInstance(): PaymentEventEmitter {
    if (!PaymentEventEmitter.instance) {
      PaymentEventEmitter.instance = new PaymentEventEmitter();
    }
    return PaymentEventEmitter.instance;
  }

  emitPaymentEvent(event: PaymentEvent): void {
    // Emit to all listeners
    this.emit("payment-event", event);

    // Also emit to user-specific channel if userId is available
    if (event.data.userId) {
      this.emit(`payment-event:${event.data.userId}`, event);
    }
  }
}

export const paymentEvents = PaymentEventEmitter.getInstance();

// =============================================================================
// Helper to create events from webhook data
// =============================================================================

export function createPaymentEvent(
  type: PaymentEventType,
  data: PaymentEvent["data"]
): PaymentEvent {
  return {
    type,
    timestamp: new Date().toISOString(),
    data,
  };
}

export function mapPaymentStatusToEventType(
  status: string
): PaymentEventType | null {
  switch (status) {
    case "approved":
      return "payment.approved";
    case "rejected":
      return "payment.rejected";
    case "pending":
    case "in_process":
    case "in_mediation":
      return "payment.pending";
    case "refunded":
      return "payment.refunded";
    default:
      return null;
  }
}

export function mapSubscriptionStatusToEventType(
  status: string
): PaymentEventType | null {
  switch (status) {
    case "authorized":
      return "subscription.authorized";
    case "active":
      return "subscription.active";
    case "paused":
      return "subscription.paused";
    case "cancelled":
      return "subscription.cancelled";
    default:
      return null;
  }
}

export function mapInvoiceStatusToEventType(
  status: string
): PaymentEventType | null {
  switch (status) {
    case "processed":
    case "paid":
      return "invoice.processed";
    case "failed":
    case "rejected":
      return "invoice.failed";
    default:
      return null;
  }
}
