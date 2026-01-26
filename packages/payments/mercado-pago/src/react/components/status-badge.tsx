import type { ReactNode } from "react";
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

const PAYMENT_STATUS_MAP: Record<PaymentStatus, PaymentStatusConfig> = {
  pending: {
    label: "Pendiente",
    color: "text-yellow-700",
    bgColor: "bg-yellow-100",
    borderColor: "border-yellow-300",
  },
  approved: {
    label: "Aprobado",
    color: "text-green-700",
    bgColor: "bg-green-100",
    borderColor: "border-green-300",
  },
  authorized: {
    label: "Autorizado",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
    borderColor: "border-blue-300",
  },
  in_process: {
    label: "En proceso",
    color: "text-yellow-700",
    bgColor: "bg-yellow-100",
    borderColor: "border-yellow-300",
  },
  in_mediation: {
    label: "En mediación",
    color: "text-orange-700",
    bgColor: "bg-orange-100",
    borderColor: "border-orange-300",
  },
  rejected: {
    label: "Rechazado",
    color: "text-red-700",
    bgColor: "bg-red-100",
    borderColor: "border-red-300",
  },
  cancelled: {
    label: "Cancelado",
    color: "text-gray-700",
    bgColor: "bg-gray-100",
    borderColor: "border-gray-300",
  },
  refunded: {
    label: "Reembolsado",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
    borderColor: "border-blue-300",
  },
  charged_back: {
    label: "Contracargo",
    color: "text-red-700",
    bgColor: "bg-red-100",
    borderColor: "border-red-300",
  },
};

export type PaymentStatusBadgeProps = {
  status: PaymentStatus | string;
  /** Custom render function for full control */
  render?: (config: PaymentStatusConfig & { status: string }) => ReactNode;
  /** CSS class name */
  className?: string;
};

/**
 * Get payment status configuration
 */
export function getPaymentStatusConfig(
  status: PaymentStatus | string
): PaymentStatusConfig {
  return (
    PAYMENT_STATUS_MAP[status as PaymentStatus] ?? {
      label: status,
      color: "text-gray-700",
      bgColor: "bg-gray-100",
      borderColor: "border-gray-300",
    }
  );
}

/**
 * Payment status badge component
 *
 * @example
 * ```tsx
 * // Default rendering
 * <PaymentStatusBadge status="approved" />
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
  render,
  className = "",
}: PaymentStatusBadgeProps) {
  const config = getPaymentStatusConfig(status);

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

const SUBSCRIPTION_STATUS_MAP: Record<
  SubscriptionStatus,
  SubscriptionStatusConfig
> = {
  pending: {
    label: "Pendiente",
    color: "text-yellow-700",
    bgColor: "bg-yellow-100",
    borderColor: "border-yellow-300",
  },
  authorized: {
    label: "Autorizada",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
    borderColor: "border-blue-300",
  },
  active: {
    label: "Activa",
    color: "text-green-700",
    bgColor: "bg-green-100",
    borderColor: "border-green-300",
  },
  paused: {
    label: "Pausada",
    color: "text-orange-700",
    bgColor: "bg-orange-100",
    borderColor: "border-orange-300",
  },
  cancelled: {
    label: "Cancelada",
    color: "text-red-700",
    bgColor: "bg-red-100",
    borderColor: "border-red-300",
  },
};

export type SubscriptionStatusBadgeProps = {
  status: SubscriptionStatus | string;
  /** Custom render function for full control */
  render?: (config: SubscriptionStatusConfig & { status: string }) => ReactNode;
  /** CSS class name */
  className?: string;
};

/**
 * Get subscription status configuration
 */
export function getSubscriptionStatusConfig(
  status: SubscriptionStatus | string
): SubscriptionStatusConfig {
  return (
    SUBSCRIPTION_STATUS_MAP[status as SubscriptionStatus] ?? {
      label: status,
      color: "text-gray-700",
      bgColor: "bg-gray-100",
      borderColor: "border-gray-300",
    }
  );
}

/**
 * Subscription status badge component
 *
 * @example
 * ```tsx
 * // Default rendering
 * <SubscriptionStatusBadge status="active" />
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
  render,
  className = "",
}: SubscriptionStatusBadgeProps) {
  const config = getSubscriptionStatusConfig(status);

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
