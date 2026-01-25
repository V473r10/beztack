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
  Plan,
  PlansResponse,
  Subscription,
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
  CardForm,
  type CardFormProps,
  CheckoutButton,
  type CheckoutButtonProps,
  PaymentBrick,
  type PaymentBrickProps,
} from "./components/index.js";
// Hooks
export {
  type ConnectionStatus,
  type PaymentEvent,
  type PaymentEventType,
  plansKeys,
  type UsePaymentEventsOptions,
  type UsePaymentEventsReturn,
  useCreatePlan,
  usePaymentEvents,
  usePlan,
  usePlans,
  useRefreshPlans,
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
