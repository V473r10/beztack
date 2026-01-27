import type { ReactNode } from "react";
import {
  DEFAULT_LOCALE,
  getPaymentStatusLabel,
  getSubscriptionStatusLabel,
} from "../../i18n/index.js";
import type { PaymentStatus, SubscriptionStatus } from "../../types.js";

// ============================================================================
// Payment Status Badge
// ============================================================================

export type PaymentStatusConfig = {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
};

type PaymentStatusStyle = {
  color: string;
  bgColor: string;
  borderColor: string;
};

const PAYMENT_STATUS_STYLES: Record<PaymentStatus, PaymentStatusStyle> = {
  pending: {
    color: "text-yellow-700",
    bgColor: "bg-yellow-100",
    borderColor: "border-yellow-300",
  },
  approved: {
    color: "text-green-700",
    bgColor: "bg-green-100",
    borderColor: "border-green-300",
  },
  authorized: {
    color: "text-blue-700",
    bgColor: "bg-blue-100",
    borderColor: "border-blue-300",
  },
  in_process: {
    color: "text-yellow-700",
    bgColor: "bg-yellow-100",
    borderColor: "border-yellow-300",
  },
  in_mediation: {
    color: "text-orange-700",
    bgColor: "bg-orange-100",
    borderColor: "border-orange-300",
  },
  rejected: {
    color: "text-red-700",
    bgColor: "bg-red-100",
    borderColor: "border-red-300",
  },
  cancelled: {
    color: "text-gray-700",
    bgColor: "bg-gray-100",
    borderColor: "border-gray-300",
  },
  refunded: {
    color: "text-blue-700",
    bgColor: "bg-blue-100",
    borderColor: "border-blue-300",
  },
  charged_back: {
    color: "text-red-700",
    bgColor: "bg-red-100",
    borderColor: "border-red-300",
  },
};

const DEFAULT_STYLE: PaymentStatusStyle = {
  color: "text-gray-700",
  bgColor: "bg-gray-100",
  borderColor: "border-gray-300",
};

export type PaymentStatusBadgeProps = {
  status: PaymentStatus | string;
  /** Locale for translations */
  locale?: string;
  /** Custom render function for full control */
  render?: (config: PaymentStatusConfig & { status: string }) => ReactNode;
  /** CSS class name */
  className?: string;
};

/**
 * Get payment status configuration with localized label
 */
export function getPaymentStatusConfig(
  status: PaymentStatus | string,
  locale: string = DEFAULT_LOCALE
): PaymentStatusConfig {
  const style = PAYMENT_STATUS_STYLES[status as PaymentStatus] ?? DEFAULT_STYLE;
  const label = getPaymentStatusLabel(status, locale);

  return { label, ...style };
}

/**
 * Payment status badge component
 *
 * @example
 * ```tsx
 * // Default rendering (Spanish)
 * <PaymentStatusBadge status="approved" />
 *
 * // English
 * <PaymentStatusBadge status="approved" locale="en-US" />
 *
 * // Custom rendering
 * <PaymentStatusBadge
 *   status="approved"
 *   render={({ label, color }) => (
 *     <Badge className={color}>{label}</Badge>
 *   )}
 * />
 * ```
 */
export function PaymentStatusBadge({
  status,
  locale = DEFAULT_LOCALE,
  render,
  className = "",
}: PaymentStatusBadgeProps) {
  const config = getPaymentStatusConfig(status, locale);

  if (render) {
    return <>{render({ ...config, status })}</>;
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-medium text-xs ${config.bgColor} ${config.color} ${config.borderColor} ${className}`}
    >
      {config.label}
    </span>
  );
}

// ============================================================================
// Subscription Status Badge
// ============================================================================

export type SubscriptionStatusConfig = {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
};

type SubscriptionStatusStyle = {
  color: string;
  bgColor: string;
  borderColor: string;
};

const SUBSCRIPTION_STATUS_STYLES: Record<
  SubscriptionStatus,
  SubscriptionStatusStyle
> = {
  pending: {
    color: "text-yellow-700",
    bgColor: "bg-yellow-100",
    borderColor: "border-yellow-300",
  },
  authorized: {
    color: "text-blue-700",
    bgColor: "bg-blue-100",
    borderColor: "border-blue-300",
  },
  active: {
    color: "text-green-700",
    bgColor: "bg-green-100",
    borderColor: "border-green-300",
  },
  paused: {
    color: "text-orange-700",
    bgColor: "bg-orange-100",
    borderColor: "border-orange-300",
  },
  cancelled: {
    color: "text-red-700",
    bgColor: "bg-red-100",
    borderColor: "border-red-300",
  },
};

export type SubscriptionStatusBadgeProps = {
  status: SubscriptionStatus | string;
  /** Locale for translations */
  locale?: string;
  /** Custom render function for full control */
  render?: (config: SubscriptionStatusConfig & { status: string }) => ReactNode;
  /** CSS class name */
  className?: string;
};

/**
 * Get subscription status configuration with localized label
 */
export function getSubscriptionStatusConfig(
  status: SubscriptionStatus | string,
  locale: string = DEFAULT_LOCALE
): SubscriptionStatusConfig {
  const style =
    SUBSCRIPTION_STATUS_STYLES[status as SubscriptionStatus] ?? DEFAULT_STYLE;
  const label = getSubscriptionStatusLabel(status, locale);

  return { label, ...style };
}

/**
 * Subscription status badge component
 *
 * @example
 * ```tsx
 * // Default rendering (Spanish)
 * <SubscriptionStatusBadge status="active" />
 *
 * // English
 * <SubscriptionStatusBadge status="active" locale="en-US" />
 *
 * // Custom rendering
 * <SubscriptionStatusBadge
 *   status="active"
 *   render={({ label, bgColor }) => (
 *     <Badge className={bgColor}>{label}</Badge>
 *   )}
 * />
 * ```
 */
export function SubscriptionStatusBadge({
  status,
  locale = DEFAULT_LOCALE,
  render,
  className = "",
}: SubscriptionStatusBadgeProps) {
  const config = getSubscriptionStatusConfig(status, locale);

  if (render) {
    return <>{render({ ...config, status })}</>;
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-medium text-xs ${config.bgColor} ${config.color} ${config.borderColor} ${className}`}
    >
      {config.label}
    </span>
  );
}
