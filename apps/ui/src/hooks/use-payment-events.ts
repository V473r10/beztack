import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { env } from "@/env";

// =============================================================================
// Types
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
    planId?: string | null;
    reason?: string | null;
    nextPaymentDate?: string | null;
  };
};

export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

type UsePaymentEventsOptions = {
  /** User ID to filter events (optional, uses authenticated user by default) */
  userId?: string;
  /** Whether to show toast notifications for events */
  showToasts?: boolean;
  /** Custom event handlers by type */
  onEvent?: (event: PaymentEvent) => void;
  /** Called when connection status changes */
  onStatusChange?: (status: ConnectionStatus) => void;
  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
  /** Reconnect delay in ms (default: 3000) */
  reconnectDelay?: number;
  /** Listen to ALL events regardless of user (for demos/admin). Default: false */
  listenToAll?: boolean;
};

// =============================================================================
// Event labels for toasts
// =============================================================================

const EVENT_LABELS: Record<
  PaymentEventType,
  { title: string; variant: "default" | "success" | "error" | "warning" }
> = {
  "payment.approved": { title: "Pago aprobado", variant: "success" },
  "payment.rejected": { title: "Pago rechazado", variant: "error" },
  "payment.pending": { title: "Pago pendiente", variant: "warning" },
  "payment.refunded": { title: "Pago reembolsado", variant: "default" },
  "subscription.authorized": {
    title: "Suscripción autorizada",
    variant: "success",
  },
  "subscription.active": { title: "Suscripción activa", variant: "success" },
  "subscription.paused": { title: "Suscripción pausada", variant: "warning" },
  "subscription.cancelled": {
    title: "Suscripción cancelada",
    variant: "error",
  },
  "invoice.processed": { title: "Cobro procesado", variant: "success" },
  "invoice.failed": { title: "Cobro fallido", variant: "error" },
  "chargeback.created": { title: "Contracargo recibido", variant: "error" },
};

function formatAmount(
  amount: string | null | undefined,
  currency: string | null | undefined
): string {
  if (!amount) {
    return "";
  }
  const num = Number.parseFloat(amount);
  if (Number.isNaN(num)) {
    return "";
  }
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: currency || "UYU",
  }).format(num);
}

// =============================================================================
// Hook
// =============================================================================

const DEFAULT_RECONNECT_DELAY = 3000;
const MAX_EVENTS_HISTORY = 50;

export function usePaymentEvents(options: UsePaymentEventsOptions = {}) {
  const {
    userId,
    showToasts = true,
    onEvent,
    onStatusChange,
    autoReconnect = true,
    reconnectDelay = DEFAULT_RECONNECT_DELAY,
    listenToAll = false,
  } = options;

  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [events, setEvents] = useState<PaymentEvent[]>([]);
  const [lastEvent, setLastEvent] = useState<PaymentEvent | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const updateStatus = useCallback(
    (newStatus: ConnectionStatus) => {
      setStatus(newStatus);
      onStatusChange?.(newStatus);
    },
    [onStatusChange]
  );

  const handleEvent = useCallback(
    (event: PaymentEvent) => {
      setEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS_HISTORY));
      setLastEvent(event);
      onEvent?.(event);

      if (showToasts) {
        const label = EVENT_LABELS[event.type];
        const amount = formatAmount(event.data.amount, event.data.currency);
        const description =
          event.data.description || event.data.reason || event.data.id;

        const message = amount ? `${description} - ${amount}` : description;

        switch (label.variant) {
          case "success":
            toast.success(label.title, { description: message });
            break;
          case "error":
            toast.error(label.title, { description: message });
            break;
          case "warning":
            toast.warning(label.title, { description: message });
            break;
          default:
            toast(label.title, { description: message });
        }
      }
    },
    [onEvent, showToasts]
  );

  const connect = useCallback(() => {
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Clear any pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    const url = new URL(`${env.VITE_API_URL}/api/payments/mercado-pago/events`);
    if (userId) {
      url.searchParams.set("userId", userId);
    }
    if (listenToAll) {
      // Only for demos/admin - listen to ALL events
      url.searchParams.set("all", "true");
    }

    updateStatus("connecting");

    // Note: withCredentials is needed to send cookies for authentication
    const eventSource = new EventSource(url.toString(), {
      withCredentials: true,
    });
    eventSourceRef.current = eventSource;

    eventSource.addEventListener("connected", () => {
      updateStatus("connected");
    });

    // Listen for all payment event types
    for (const eventType of Object.keys(EVENT_LABELS)) {
      eventSource.addEventListener(eventType, (e) => {
        try {
          const data = JSON.parse(e.data) as PaymentEvent;
          handleEvent(data);
        } catch {
          // Ignore parse errors
        }
      });
    }

    eventSource.onerror = () => {
      updateStatus("error");
      eventSource.close();

      if (autoReconnect) {
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, reconnectDelay);
      }
    };
  }, [userId, updateStatus, handleEvent, autoReconnect, reconnectDelay]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    updateStatus("disconnected");
  }, [updateStatus]);

  const clearEvents = useCallback(() => {
    setEvents([]);
    setLastEvent(null);
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    /** Current connection status */
    status,
    /** All received events (most recent first, max 50) */
    events,
    /** Most recent event */
    lastEvent,
    /** Manually connect to SSE */
    connect,
    /** Disconnect from SSE */
    disconnect,
    /** Clear event history */
    clearEvents,
    /** Whether currently connected */
    isConnected: status === "connected",
  };
}
