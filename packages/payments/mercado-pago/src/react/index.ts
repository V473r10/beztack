/**
 * @beztack/mercadopago/react
 *
 * React components and hooks for Mercado Pago integration
 */

// Re-export types commonly used with React components
export type {
  CreatePlanData,
  CreatePlanResponse,
  CreateSubscriptionData,
  PaymentStatus,
  Plan,
  PlansResponse,
  Subscription,
  SubscriptionStatus,
  SyncPlansResponse,
} from "../types.js";

// Re-export utility functions
export {
  formatFrequency,
  formatPlanPrice,
  getStatusColor,
  getStatusLabel,
} from "../types.js";

// Components
export {
  // Billing
  BillingHistory,
  type BillingHistoryProps,
  type BillingHistoryRenderProps,
  // Payment components
  CardForm,
  type CardFormProps,
  CheckoutButton,
  type CheckoutButtonProps,
  type FormattedInvoice,
  // Status badges
  getPaymentStatusConfig,
  getSubscriptionStatusConfig,
  type InvoiceData,
  PaymentBrick,
  type PaymentBrickProps,
  PaymentStatusBadge,
  type PaymentStatusBadgeProps,
  type PaymentStatusConfig,
  type SubscriptionAction,
  SubscriptionActions,
  type SubscriptionActionsProps,
  type SubscriptionActionsRenderProps,
  // Subscription components
  SubscriptionCard,
  type SubscriptionCardProps,
  type SubscriptionCardRenderProps,
  type SubscriptionData,
  SubscriptionList,
  type SubscriptionListProps,
  type SubscriptionListRenderProps,
  SubscriptionStatusBadge,
  type SubscriptionStatusBadgeProps,
  type SubscriptionStatusConfig,
} from "./components/index.js";

// Hooks
export {
  // Payment events
  type ConnectionStatus,
  // Subscriptions
  type InvoiceResponse,
  type InvoicesResponse,
  type PaymentEvent,
  type PaymentEventType,
  // Plans
  plansKeys,
  type SubscriptionResponse,
  type SubscriptionsSearchResponse,
  subscriptionsKeys,
  type UsePaymentEventsOptions,
  type UsePaymentEventsReturn,
  type UseSubscriptionsOptions,
  useCancelSubscription,
  useCreatePlan,
  usePauseSubscription,
  usePaymentEvents,
  usePlan,
  usePlans,
  useRefreshPlans,
  useResumeSubscription,
  useSubscription,
  useSubscriptionInvoices,
  useSubscriptions,
  useSyncPlans,
} from "./hooks/index.js";

// Provider
export {
  type MercadoPagoContextValue,
  type MercadoPagoLocale,
  MercadoPagoProvider,
  type MercadoPagoProviderProps,
  useMercadoPagoContext,
} from "./provider.js";
