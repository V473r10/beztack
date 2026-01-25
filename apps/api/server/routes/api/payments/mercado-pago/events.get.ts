import {
  createError,
  defineEventHandler,
  getHeader,
  getQuery,
  setResponseHeader,
} from "h3";
import { auth } from "@/server/utils/auth";
import {
  type PaymentEvent,
  paymentEvents,
} from "@/server/utils/payment-events";

/**
 * SSE endpoint for real-time payment and subscription events.
 *
 * Query params:
 * - userId: Filter events for a specific user (optional, defaults to authenticated user)
 * - all: If "true", listen to all events (for demo/testing)
 *
 * Usage:
 * ```typescript
 * const eventSource = new EventSource('/api/payments/mercado-pago/events')
 * eventSource.onmessage = (event) => {
 *   const data = JSON.parse(event.data)
 *   console.log('Payment event:', data)
 * }
 * ```
 */
export default defineEventHandler(async (event) => {
  // Get authenticated user
  const session = await auth.api.getSession({ headers: event.headers });
  const query = getQuery(event);

  // Allow userId override for admin/testing, otherwise use authenticated user
  const userId = (query.userId as string) || session?.user?.id;

  if (!(userId || query.all)) {
    throw createError({
      statusCode: 401,
      message: "Authentication required or provide userId parameter",
    });
  }

  // Set SSE headers
  setResponseHeader(event, "Content-Type", "text/event-stream");
  setResponseHeader(event, "Cache-Control", "no-cache");
  setResponseHeader(event, "Connection", "keep-alive");

  // Handle CORS properly for SSE
  const origin = getHeader(event, "origin");
  if (origin) {
    setResponseHeader(event, "Access-Control-Allow-Origin", origin);
    setResponseHeader(event, "Access-Control-Allow-Credentials", "true");
  }

  // Get the underlying response object
  const response = event.node.res;

  // Send initial connection event
  response.write(
    `event: connected\ndata: ${JSON.stringify({ userId, timestamp: new Date().toISOString() })}\n\n`
  );

  // Keep-alive interval (send comment every 30 seconds to prevent timeout)
  const KEEP_ALIVE_INTERVAL_MS = 30_000;
  const keepAliveInterval = setInterval(() => {
    response.write(`: keep-alive ${new Date().toISOString()}\n\n`);
  }, KEEP_ALIVE_INTERVAL_MS);

  // Event handler
  const handleEvent = (paymentEvent: PaymentEvent) => {
    const eventData = JSON.stringify(paymentEvent);
    response.write(`event: ${paymentEvent.type}\ndata: ${eventData}\n\n`);
  };

  // Subscribe to the appropriate channel
  // - If "all=true" is set, listen to all events (for demos/admin)
  // - Otherwise, listen only to the authenticated user's events
  const listenToAll = query.all === "true";
  const eventChannel = listenToAll
    ? "payment-event"
    : `payment-event:${userId}`;

  // biome-ignore lint/suspicious/noConsole: SSE debugging
  console.log("[SSE Events] Client connected:", {
    userId,
    listenToAll,
    channel: eventChannel,
  });

  paymentEvents.on(eventChannel, handleEvent);

  // Cleanup on connection close
  event.node.req.on("close", () => {
    // biome-ignore lint/suspicious/noConsole: SSE debugging
    console.log("[SSE Events] Client disconnected:", {
      userId,
      channel: eventChannel,
    });
    clearInterval(keepAliveInterval);
    paymentEvents.off(eventChannel, handleEvent);
    response.end();
  });

  // Return a promise that never resolves (keeps connection open)
  return new Promise(() => {
    // Connection stays open until client disconnects
  });
});
