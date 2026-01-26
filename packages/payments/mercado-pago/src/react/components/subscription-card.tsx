import type { ReactNode } from "react";
import { formatFrequency, formatPlanPrice } from "../../types.js";
import {
  getSubscriptionStatusConfig,
  type SubscriptionStatusConfig,
} from "./status-badge.js";

// ============================================================================
// Types
// ============================================================================

export type SubscriptionData = {
  id: string;
  status: string;
  reason?: string | null;
  payerEmail?: string | null;
  frequency?: number | null;
  frequencyType?: string | null;
  transactionAmount?: number | string | null;
  currencyId?: string | null;
  nextPaymentDate?: string | null;
  dateCreated?: string | null;
  chargedQuantity?: number | null;
  chargedAmount?: number | string | null;
};

export type SubscriptionCardRenderProps = {
  subscription: SubscriptionData;
  statusConfig: SubscriptionStatusConfig;
  formattedPrice: string | null;
  formattedFrequency: string | null;
  formattedNextPayment: string | null;
  formattedDateCreated: string | null;
};

export type SubscriptionCardProps = {
  subscription: SubscriptionData;
  /** Locale for date formatting */
  locale?: string;
  /** Custom render function for full control */
  render?: (props: SubscriptionCardRenderProps) => ReactNode;
  /** Called when card is clicked */
  onClick?: (subscription: SubscriptionData) => void;
  /** Additional CSS classes */
  className?: string;
  /** Show next payment date */
  showNextPayment?: boolean;
  /** Show charged stats */
  showStats?: boolean;
};

// ============================================================================
// Helpers
// ============================================================================

function formatDate(
  dateStr: string | null | undefined,
  locale: string
): string | null {
  if (!dateStr) {
    return null;
  }
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(
  dateStr: string | null | undefined,
  locale: string
): string | null {
  if (!dateStr) {
    return null;
  }
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildRenderProps(
  subscription: SubscriptionData,
  locale: string
): SubscriptionCardRenderProps {
  const statusConfig = getSubscriptionStatusConfig(subscription.status);

  const formattedPrice =
    subscription.transactionAmount && subscription.currencyId
      ? formatPlanPrice(subscription.transactionAmount, subscription.currencyId)
      : null;

  const formattedFrequency =
    subscription.frequency && subscription.frequencyType
      ? formatFrequency(subscription.frequency, subscription.frequencyType)
      : null;

  const formattedNextPayment = formatDateTime(
    subscription.nextPaymentDate,
    locale
  );
  const formattedDateCreated = formatDate(subscription.dateCreated, locale);

  return {
    subscription,
    statusConfig,
    formattedPrice,
    formattedFrequency,
    formattedNextPayment,
    formattedDateCreated,
  };
}

// ============================================================================
// Component
// ============================================================================

/**
 * Subscription card component with flexible rendering
 *
 * @example
 * ```tsx
 * // Default rendering with Tailwind classes
 * <SubscriptionCard subscription={sub} />
 *
 * // Custom rendering with shadcn/ui
 * <SubscriptionCard
 *   subscription={sub}
 *   render={({ subscription, statusConfig, formattedPrice }) => (
 *     <Card>
 *       <CardHeader>
 *         <CardTitle>{subscription.reason}</CardTitle>
 *         <Badge className={statusConfig.bgColor}>
 *           {statusConfig.label}
 *         </Badge>
 *       </CardHeader>
 *       <CardContent>
 *         <p>{formattedPrice}</p>
 *       </CardContent>
 *     </Card>
 *   )}
 * />
 * ```
 */
export function SubscriptionCard({
  subscription,
  locale = "es-UY",
  render,
  onClick,
  className = "",
  showNextPayment = true,
  showStats = false,
}: SubscriptionCardProps) {
  const renderProps = buildRenderProps(subscription, locale);
  const { statusConfig, formattedPrice, formattedFrequency } = renderProps;
  const { formattedNextPayment, formattedDateCreated } = renderProps;

  if (render) {
    return <>{render(renderProps)}</>;
  }

  const isClickable = !!onClick;
  const handleClick = () => onClick?.(subscription);

  const CardWrapper = isClickable ? "button" : "div";

  return (
    <CardWrapper
      className={`rounded-lg border bg-white p-4 text-left shadow-sm ${isClickable ? "w-full cursor-pointer hover:border-blue-300 hover:shadow-md" : ""} ${className}`}
      onClick={isClickable ? handleClick : undefined}
      type={isClickable ? "button" : undefined}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium text-gray-900">
            {subscription.reason || "Suscripción"}
          </h3>
          {subscription.payerEmail && (
            <p className="truncate text-gray-500 text-sm">
              {subscription.payerEmail}
            </p>
          )}
        </div>
        <span
          className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 font-medium text-xs ${statusConfig.bgColor} ${statusConfig.color} ${statusConfig.borderColor}`}
        >
          {statusConfig.label}
        </span>
      </div>

      {/* Price */}
      {formattedPrice && (
        <div className="mt-3">
          <span className="font-bold text-2xl text-gray-900">
            {formattedPrice}
          </span>
          {formattedFrequency && (
            <span className="ml-1 text-gray-500 text-sm">
              {formattedFrequency}
            </span>
          )}
        </div>
      )}

      {/* Next payment */}
      {showNextPayment && formattedNextPayment && (
        <div className="mt-3 text-gray-600 text-sm">
          <span className="font-medium">Próximo cobro:</span>{" "}
          {formattedNextPayment}
        </div>
      )}

      {/* Stats */}
      {showStats && subscription.chargedQuantity !== null && (
        <div className="mt-3 flex gap-4 border-t pt-3 text-gray-600 text-sm">
          <div>
            <span className="font-medium">Cobros:</span>{" "}
            {subscription.chargedQuantity}
          </div>
          {subscription.chargedAmount && (
            <div>
              <span className="font-medium">Total:</span>{" "}
              {formatPlanPrice(
                subscription.chargedAmount,
                subscription.currencyId || "UYU"
              )}
            </div>
          )}
        </div>
      )}

      {/* Created date */}
      {formattedDateCreated && (
        <div className="mt-2 text-gray-400 text-xs">
          Creada: {formattedDateCreated}
        </div>
      )}
    </CardWrapper>
  );
}
