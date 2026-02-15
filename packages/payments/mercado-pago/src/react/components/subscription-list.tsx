import type { ReactNode } from "react";
import { DEFAULT_LOCALE, t } from "../../i18n/index.js";
import {
  SubscriptionCard,
  type SubscriptionCardProps,
  type SubscriptionData,
} from "./subscription-card.js";

// ============================================================================
// Types
// ============================================================================

export type SubscriptionListRenderProps = {
  subscriptions: SubscriptionData[];
  isLoading: boolean;
  isEmpty: boolean;
  selectedId: string | null;
};

export type SubscriptionListProps = {
  subscriptions: SubscriptionData[];
  /** Loading state */
  isLoading?: boolean;
  /** Currently selected subscription ID */
  selectedId?: string | null;
  /** Called when a subscription is selected */
  onSelect?: (subscription: SubscriptionData) => void;
  /** Custom render function for full control */
  render?: (props: SubscriptionListRenderProps) => ReactNode;
  /** Custom card render props (passed to each SubscriptionCard) */
  cardProps?: Partial<Omit<SubscriptionCardProps, "subscription" | "onClick">>;
  /** Additional CSS classes */
  className?: string;
  /** Grid columns (default: responsive) */
  columns?: 1 | 2 | 3 | 4;
  /** Locale for translations */
  locale?: string;
  /** Empty state message */
  emptyMessage?: string;
  /** Loading message */
  loadingMessage?: string;
};

// ============================================================================
// Sub-components
// ============================================================================

function LoadingState({ message }: { message: string }) {
  return (
    <div className="py-12 text-center text-gray-500">
      <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-12 text-center text-gray-500">
      <p>{message}</p>
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

const GRID_CLASSES: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
};

/**
 * Subscription list component with grid layout
 *
 * @example
 * ```tsx
 * // Default rendering
 * <SubscriptionList
 *   subscriptions={subscriptions}
 *   isLoading={isLoading}
 *   onSelect={handleSelect}
 * />
 *
 * // Custom grid columns
 * <SubscriptionList
 *   subscriptions={subscriptions}
 *   columns={2}
 *   cardProps={{ showStats: true }}
 * />
 *
 * // Full custom rendering
 * <SubscriptionList
 *   subscriptions={subscriptions}
 *   render={({ subscriptions, isLoading }) => (
 *     <CustomGrid>
 *       {subscriptions.map(sub => (
 *         <CustomCard key={sub.id} subscription={sub} />
 *       ))}
 *     </CustomGrid>
 *   )}
 * />
 * ```
 */
export function SubscriptionList({
  subscriptions,
  isLoading = false,
  selectedId = null,
  onSelect,
  render,
  cardProps = {},
  className = "",
  columns = 3,
  locale = DEFAULT_LOCALE,
  emptyMessage,
  loadingMessage,
}: SubscriptionListProps) {
  const isEmpty = subscriptions.length === 0;

  // Use i18n defaults if not provided
  const resolvedEmptyMessage =
    emptyMessage ?? t(locale, "components.noSubscriptions");
  const resolvedLoadingMessage =
    loadingMessage ?? t(locale, "components.loadingSubscriptions");

  const renderProps: SubscriptionListRenderProps = {
    subscriptions,
    isLoading,
    isEmpty,
    selectedId,
  };

  if (render) {
    return <>{render(renderProps)}</>;
  }

  if (isLoading) {
    return <LoadingState message={resolvedLoadingMessage} />;
  }

  if (isEmpty) {
    return <EmptyState message={resolvedEmptyMessage} />;
  }

  const gridClass = GRID_CLASSES[columns] || GRID_CLASSES[3];

  return (
    <div className={`grid gap-4 ${gridClass} ${className}`}>
      {subscriptions.map((subscription) => (
        <SubscriptionCard
          key={subscription.id}
          locale={locale}
          onClick={onSelect}
          subscription={subscription}
          {...cardProps}
          className={`${selectedId === subscription.id ? "ring-2 ring-blue-500" : ""} ${cardProps.className || ""}`}
        />
      ))}
    </div>
  );
}
