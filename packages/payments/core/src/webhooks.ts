/**
 * Provider-agnostic webhook utilities
 */
import crypto from "node:crypto";

import type { WebhookPayloadData, WebhookPayloadHandler } from "./types.js";

const SHA256_PREFIX_LENGTH = 7;

/**
 * Verify a webhook signature using HMAC SHA-256
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(payload, "utf8")
      .digest("hex");

    const normalizedSignature = signature.startsWith("sha256=")
      ? signature.slice(SHA256_PREFIX_LENGTH)
      : signature;

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, "hex"),
      Buffer.from(normalizedSignature, "hex")
    );
  } catch {
    return false;
  }
}

/**
 * Create default webhook handlers for common events.
 * Pass custom handler callbacks to override the defaults.
 */
export function createDefaultWebhookHandlers(
  customHandlers: Record<string, WebhookPayloadHandler> = {}
): Record<string, WebhookPayloadHandler> {
  const noop = async (_payload: WebhookPayloadData): Promise<void> => {
    // Default no-op handler
  };

  return {
    "order.paid": customHandlers.onOrderPaid ?? noop,
    "subscription.active": customHandlers.onSubscriptionActive ?? noop,
    "subscription.canceled": customHandlers.onSubscriptionCanceled ?? noop,
    "subscription.revoked": customHandlers.onSubscriptionRevoked ?? noop,
    "subscription.updated": customHandlers.onSubscriptionUpdated ?? noop,
    "customer.updated": customHandlers.onCustomerStateChanged ?? noop,
    "benefit.grant.created": customHandlers.onBenefitGrantCreated ?? noop,
    "benefit.grant.revoked": customHandlers.onBenefitGrantRevoked ?? noop,
    ...Object.fromEntries(
      Object.entries(customHandlers).filter(([key]) => !key.startsWith("on"))
    ),
  };
}

export type {
  MembershipUpdate,
  WebhookPayloadData,
  WebhookPayloadHandler,
} from "./types.js";
