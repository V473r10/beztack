/**
 * @beztack/payments — Provider-agnostic payment abstraction
 *
 * Apps should import from this package only, never from provider packages directly.
 */

// Types
export type {
	BillingInterval,
	CheckoutResult,
	CreateCheckoutOptions,
	CreateSubscriptionOptions,
	Customer,
	ListSubscriptionsOptions,
	MembershipUpdate,
	PaymentProviderAdapter,
	PaymentProviderName,
	PricingTier,
	Product,
	ProviderAdapterFactory,
	ProviderProduct,
	Subscription,
	SubscriptionStatus,
	UpdateSubscriptionOptions,
	WebhookEventType,
	WebhookPayload,
	WebhookPayloadData,
	WebhookPayloadHandler,
} from "./types.js"

// Factory
export {
	createPaymentProvider,
	getPaymentProvider,
	getRegisteredProviders,
	resetPaymentProvider,
} from "./factory.js"

// Webhook utilities
export {
	createDefaultWebhookHandlers,
	verifyWebhookSignature,
} from "./webhooks.js"
