import type { ReactNode } from "react";
import { DEFAULT_LOCALE, formatPriceLocalized, t } from "../../i18n/index.js";
import {
  getPaymentStatusConfig,
  type PaymentStatusConfig,
} from "./status-badge.js";

// ============================================================================
// Types
// ============================================================================

export type InvoiceData = {
  id: string;
  subscriptionId?: string | null;
  paymentId?: string | null;
  status: string;
  reason?: string | null;
  transactionAmount?: number | string | null;
  currencyId?: string | null;
  debitDate?: string | null;
  dateCreated?: string | null;
  retryAttempt?: number | null;
};

export type BillingHistoryRenderProps = {
  invoices: InvoiceData[];
  isLoading: boolean;
  isEmpty: boolean;
  formatInvoice: (invoice: InvoiceData) => FormattedInvoice;
};

export type FormattedInvoice = {
  invoice: InvoiceData;
  statusConfig: PaymentStatusConfig;
  formattedAmount: string | null;
  formattedDate: string | null;
};

export type BillingHistoryProps = {
  invoices: InvoiceData[];
  /** Loading state */
  isLoading?: boolean;
  /** Locale for date formatting */
  locale?: string;
  /** Custom render function for full control */
  render?: (props: BillingHistoryRenderProps) => ReactNode;
  /** Custom item render function */
  renderItem?: (formatted: FormattedInvoice, index: number) => ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Empty state message */
  emptyMessage?: string;
  /** Loading message */
  loadingMessage?: string;
  /** Title */
  title?: string;
  /** Show title */
  showTitle?: boolean;
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

function createFormatInvoice(locale: string) {
  return (invoice: InvoiceData): FormattedInvoice => {
    const statusConfig = getPaymentStatusConfig(invoice.status, locale);
    const formattedAmount =
      invoice.transactionAmount && invoice.currencyId
        ? formatPriceLocalized(
            invoice.transactionAmount,
            invoice.currencyId,
            locale
          )
        : null;
    const formattedDate = formatDate(
      invoice.debitDate || invoice.dateCreated,
      locale
    );

    return {
      invoice,
      statusConfig,
      formattedAmount,
      formattedDate,
    };
  };
}

// ============================================================================
// Sub-components
// ============================================================================

function LoadingState({ message }: { message: string }) {
  return (
    <div className="py-8 text-center text-gray-500">
      <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-8 text-center text-gray-500">
      <p className="text-sm">{message}</p>
    </div>
  );
}

function InvoiceItem({
  formatted,
  locale,
}: {
  formatted: FormattedInvoice;
  locale: string;
}) {
  const { invoice, statusConfig, formattedAmount, formattedDate } = formatted;
  const retryAttempt = invoice.retryAttempt ?? 0;

  return (
    <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 text-sm">
            {formattedAmount || "-"}
          </span>
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${statusConfig.bgColor} ${statusConfig.color} ${statusConfig.borderColor}`}
          >
            {statusConfig.label}
          </span>
        </div>
        {invoice.reason && (
          <p className="mt-0.5 truncate text-gray-500 text-xs">
            {invoice.reason}
          </p>
        )}
      </div>
      <div className="ml-4 shrink-0 text-right">
        {formattedDate && (
          <p className="text-gray-500 text-xs">{formattedDate}</p>
        )}
        {retryAttempt > 0 && (
          <p className="text-orange-600 text-xs">
            {t(locale, "components.attempt")} {retryAttempt}
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

/**
 * Billing history component for displaying subscription invoices
 *
 * @example
 * ```tsx
 * // Default rendering
 * <BillingHistory invoices={invoices} isLoading={isLoading} />
 *
 * // Custom item rendering
 * <BillingHistory
 *   invoices={invoices}
 *   renderItem={({ invoice, formattedAmount, statusConfig }) => (
 *     <Card key={invoice.id}>
 *       <CardContent>
 *         <p>{formattedAmount}</p>
 *         <Badge className={statusConfig.bgColor}>
 *           {statusConfig.label}
 *         </Badge>
 *       </CardContent>
 *     </Card>
 *   )}
 * />
 * ```
 */
export function BillingHistory({
  invoices,
  isLoading = false,
  locale = DEFAULT_LOCALE,
  render,
  renderItem,
  className = "",
  emptyMessage,
  loadingMessage,
  title,
  showTitle = true,
}: BillingHistoryProps) {
  const formatInvoice = createFormatInvoice(locale);
  const isEmpty = invoices.length === 0;

  // Use i18n defaults if not provided
  const resolvedEmptyMessage =
    emptyMessage ?? t(locale, "components.noInvoices");
  const resolvedLoadingMessage =
    loadingMessage ?? t(locale, "components.loadingHistory");
  const resolvedTitle = title ?? t(locale, "components.billingHistory");

  const renderProps: BillingHistoryRenderProps = {
    invoices,
    isLoading,
    isEmpty,
    formatInvoice,
  };

  if (render) {
    return <>{render(renderProps)}</>;
  }

  const renderContent = () => {
    if (isLoading) {
      return <LoadingState message={resolvedLoadingMessage} />;
    }

    if (isEmpty) {
      return <EmptyState message={resolvedEmptyMessage} />;
    }

    return (
      <div className="divide-y">
        {invoices.map((invoice, index) => {
          const formatted = formatInvoice(invoice);

          if (renderItem) {
            return renderItem(formatted, index);
          }

          return (
            <InvoiceItem
              formatted={formatted}
              key={invoice.id}
              locale={locale}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className={`rounded-lg border bg-white ${className}`}>
      {showTitle && (
        <div className="border-b px-4 py-3">
          <h3 className="font-medium text-gray-900">{resolvedTitle}</h3>
        </div>
      )}
      <div className="p-4">{renderContent()}</div>
    </div>
  );
}
