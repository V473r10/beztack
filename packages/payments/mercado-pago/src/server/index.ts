/**
 * @beztack/mercadopago/server
 *
 * Server-side SDK for Mercado Pago integration
 */

// Re-export types needed for server usage
export type {
  // Preference types
  CreatePreferenceData,
  MPChargebackResponse,
  // Other MP types
  MPInvoiceResponse,
  MPMerchantOrderResponse,
  // Payment types
  MPPaymentResponse,
  MPPreapproval,
  // Plan types
  MPPreapprovalPlan,
  // Subscription types
  MPSubscriptionResponse,
  PreferenceBackUrls,
  PreferenceItem,
  PreferencePayer,
  PreferenceResponse,
  ProcessPaymentData,
  ProcessPaymentResponse,
  // Webhook types
  WebhookPayload,
} from "../types.js";
// Re-export utility functions
export { parseDate, toStringId } from "../types.js";
export {
  createMercadoPagoClient,
  type MercadoPagoClient,
  type MercadoPagoConfig,
} from "./client.js";
