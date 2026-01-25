import { useCallback, useEffect, useRef, useState } from "react";
import { useMercadoPagoContext } from "../provider.js";

// ============================================================================
// Constants
// ============================================================================

const MAX_STORED_EVENTS = 100;

// ============================================================================
// Types
// ============================================================================

export type PaymentEventType =
  | "payment"
  | "subscription"
  | "invoice"
  | "order"
  | "chargeback";

export type PaymentEvent = {
  id: string;
  type: PaymentEventType;
  action: string;
  resourceId: string;
  timestamp: string;
  data?: Record<string, unknown>;
};

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export type UsePaymentEventsOptions = {
  enabled?: boolean;
  onEvent?: (event: PaymentEvent) => void;
  onError?: (error: Error) => void;
  reconnectInterval?: number;
  maxRetries?: number;
};

export type UsePaymentEventsReturn = {
  events: PaymentEvent[];
  connectionStatus: ConnectionStatus;
  clearEvents: () => void;
  reconnect: () => void;
};

// ============================================================================
// Hook
// ============================================================================

export function usePaymentEvents(
  options: UsePaymentEventsOptions = {}
): UsePaymentEventsReturn {
  const { endpoints } = useMercadoPagoContext();
  const {
    enabled = true,
    onEvent,
    onError,
    reconnectInterval = 5000,
    maxRetries = 5,
  } = options;

  const [events, setEvents] = useState<PaymentEvent[]>([]);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected");

  const eventSourceRef = useRef<EventSource | null>(null);
  const retriesRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!enabled) {
      return;
    }

    clearReconnectTimeout();

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setConnectionStatus("connecting");

    const eventSource = new EventSource(endpoints.events);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setConnectionStatus("connected");
      retriesRef.current = 0;
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as PaymentEvent;
        setEvents((prev: PaymentEvent[]) =>
          [data, ...prev].slice(0, MAX_STORED_EVENTS)
        );
        onEvent?.(data);
      } catch {
        // Ignore parse errors for heartbeat messages
      }
    };

    eventSource.onerror = () => {
      setConnectionStatus("disconnected");
      eventSource.close();

      if (retriesRef.current < maxRetries) {
        retriesRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, reconnectInterval);
      } else {
        onError?.(new Error("Max reconnection attempts reached"));
      }
    };
  }, [
    enabled,
    endpoints.events,
    onEvent,
    onError,
    reconnectInterval,
    maxRetries,
    clearReconnectTimeout,
  ]);

  const reconnect = useCallback(() => {
    retriesRef.current = 0;
    connect();
  }, [connect]);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      clearReconnectTimeout();
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [enabled, connect, clearReconnectTimeout]);

  return {
    events,
    connectionStatus,
    clearEvents,
    reconnect,
  };
}
