import type { ReactNode } from "react";
import type { SubscriptionData } from "./subscription-card.js";

// ============================================================================
// Types
// ============================================================================

export type SubscriptionAction = "pause" | "resume" | "cancel";

export type SubscriptionActionsRenderProps = {
  subscription: SubscriptionData;
  canPause: boolean;
  canResume: boolean;
  canCancel: boolean;
  isPausing: boolean;
  isResuming: boolean;
  isCancelling: boolean;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
};

export type SubscriptionActionsProps = {
  subscription: SubscriptionData;
  /** Called when pause is requested */
  onPause?: (subscription: SubscriptionData) => void | Promise<void>;
  /** Called when resume is requested */
  onResume?: (subscription: SubscriptionData) => void | Promise<void>;
  /** Called when cancel is requested */
  onCancel?: (subscription: SubscriptionData) => void | Promise<void>;
  /** Whether pause action is in progress */
  isPausing?: boolean;
  /** Whether resume action is in progress */
  isResuming?: boolean;
  /** Whether cancel action is in progress */
  isCancelling?: boolean;
  /** Custom render function for full control */
  render?: (props: SubscriptionActionsRenderProps) => ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Require confirmation before cancel */
  confirmCancel?: boolean;
  /** Custom cancel confirmation message */
  cancelConfirmMessage?: string;
};

// ============================================================================
// Helpers
// ============================================================================

const PAUSABLE_STATUSES = ["authorized", "active"];
const RESUMABLE_STATUSES = ["paused"];
const CANCELLABLE_STATUSES = ["authorized", "active", "paused", "pending"];

function canPerformAction(status: string, allowedStatuses: string[]): boolean {
  return allowedStatuses.includes(status);
}

// ============================================================================
// Component
// ============================================================================

/**
 * Subscription actions component with flexible rendering
 *
 * @example
 * ```tsx
 * // Default rendering
 * <SubscriptionActions
 *   subscription={sub}
 *   onPause={handlePause}
 *   onCancel={handleCancel}
 * />
 *
 * // Custom rendering
 * <SubscriptionActions
 *   subscription={sub}
 *   onPause={pauseMutation.mutate}
 *   onCancel={cancelMutation.mutate}
 *   isPausing={pauseMutation.isPending}
 *   isCancelling={cancelMutation.isPending}
 *   render={({ canPause, canCancel, onPause, onCancel, isPausing }) => (
 *     <div className="flex gap-2">
 *       {canPause && (
 *         <Button onClick={onPause} disabled={isPausing}>
 *           {isPausing ? "Pausando..." : "Pausar"}
 *         </Button>
 *       )}
 *       {canCancel && (
 *         <Button variant="destructive" onClick={onCancel}>
 *           Cancelar
 *         </Button>
 *       )}
 *     </div>
 *   )}
 * />
 * ```
 */
export function SubscriptionActions({
  subscription,
  onPause,
  onResume,
  onCancel,
  isPausing = false,
  isResuming = false,
  isCancelling = false,
  render,
  className = "",
  confirmCancel = true,
  cancelConfirmMessage = "¿Estás seguro de que deseas cancelar esta suscripción? Esta acción no se puede deshacer.",
}: SubscriptionActionsProps) {
  const canPause =
    !!onPause && canPerformAction(subscription.status, PAUSABLE_STATUSES);
  const canResume =
    !!onResume && canPerformAction(subscription.status, RESUMABLE_STATUSES);
  const canCancel =
    !!onCancel && canPerformAction(subscription.status, CANCELLABLE_STATUSES);

  const handlePause = () => {
    onPause?.(subscription);
  };

  const handleResume = () => {
    onResume?.(subscription);
  };

  const handleCancel = () => {
    if (confirmCancel) {
      // eslint-disable-next-line no-alert
      const confirmed = window.confirm(cancelConfirmMessage);
      if (!confirmed) {
        return;
      }
    }
    onCancel?.(subscription);
  };

  const renderProps: SubscriptionActionsRenderProps = {
    subscription,
    canPause,
    canResume,
    canCancel,
    isPausing,
    isResuming,
    isCancelling,
    onPause: handlePause,
    onResume: handleResume,
    onCancel: handleCancel,
  };

  if (render) {
    return <>{render(renderProps)}</>;
  }

  const hasActions = canPause || canResume || canCancel;
  if (!hasActions) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {canPause && (
        <button
          className="rounded-md bg-orange-100 px-3 py-1.5 font-medium text-orange-700 text-sm hover:bg-orange-200 disabled:opacity-50"
          disabled={isPausing}
          onClick={handlePause}
          type="button"
        >
          {isPausing ? "Pausando..." : "Pausar"}
        </button>
      )}

      {canResume && (
        <button
          className="rounded-md bg-green-100 px-3 py-1.5 font-medium text-green-700 text-sm hover:bg-green-200 disabled:opacity-50"
          disabled={isResuming}
          onClick={handleResume}
          type="button"
        >
          {isResuming ? "Reanudando..." : "Reanudar"}
        </button>
      )}

      {canCancel && (
        <button
          className="rounded-md bg-red-100 px-3 py-1.5 font-medium text-red-700 text-sm hover:bg-red-200 disabled:opacity-50"
          disabled={isCancelling}
          onClick={handleCancel}
          type="button"
        >
          {isCancelling ? "Cancelando..." : "Cancelar"}
        </button>
      )}
    </div>
  );
}
