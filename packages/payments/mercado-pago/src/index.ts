/**
 * @beztack/mercadopago
 *
 * Mercado Pago SDK for Beztack
 * Exports shared types and utilities
 */

export type { SupportedLocale, TranslationKeys } from "./i18n/index.js";
// i18n
export {
  DEFAULT_LOCALE,
  formatFrequencyLocalized,
  formatPriceLocalized,
  getPaymentStatusLabel,
  getPlanStatusLabel,
  getSubscriptionStatusLabel,
  getTranslations,
  resolveLocale,
  t,
} from "./i18n/index.js";
// Types
export type {
  CreatePlanData,
  CreatePlanResponse,
  CreatePreferenceData,
  CreateSubscriptionData,
  CreateSubscriptionResponse,
  // Plan types
  FrequencyType,
  MPChargebackResponse,
  MPInvoiceResponse,
  MPInvoiceSearchResponse,
  MPMerchantOrderResponse,
  // MP API Response types
  MPPaymentResponse,
  MPPaymentSearchParams,
  MPPaymentSearchResponse,
  MPPreapproval,
  MPPreapprovalPlan,
  MPRefundResponse,
  MPSubscriptionResponse,
  // Payment types
  PaymentStatus,
  Plan,
  PlanStatus,
  PlansResponse,
  PreferenceBackUrls,
  // Preference types
  PreferenceItem,
  PreferencePayer,
  PreferenceResponse,
  ProcessPaymentData,
  ProcessPaymentResponse,
  Subscription,
  // Subscription types
  SubscriptionStatus,
  SubscriptionsSearchResponse,
  SyncPlansResponse,
  // Webhook types
  WebhookPayload,
} from "./types.js";
// Schemas
// Utility functions
export {
  createPlanSchema,
  createSubscriptionSchema,
  formatFrequency,
  formatPlanPrice,
  frequencyTypeSchema,
  getStatusColor,
  getStatusLabel,
  parseDate,
  planStatusSchema,
  subscriptionStatusSchema,
  toStringId,
} from "./types.js";
