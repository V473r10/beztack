// ============================================================================
// Supported Locales
// ============================================================================

export type SupportedLocale = "es-UY" | "es" | "en-US" | "en";

export const DEFAULT_LOCALE: SupportedLocale = "es-UY";

// ============================================================================
// Translation Keys
// ============================================================================

export type TranslationKeys = {
  // Payment statuses
  paymentStatus: {
    pending: string;
    approved: string;
    authorized: string;
    in_process: string;
    in_mediation: string;
    rejected: string;
    cancelled: string;
    refunded: string;
    charged_back: string;
  };

  // Subscription statuses
  subscriptionStatus: {
    pending: string;
    authorized: string;
    active: string;
    paused: string;
    cancelled: string;
  };

  // Plan statuses
  planStatus: {
    active: string;
    inactive: string;
  };

  // Frequency labels
  frequency: {
    day: string;
    days: string;
    month: string;
    months: string;
    every: string;
    everyN: string; // "cada {n} {unit}"
  };

  // Component labels
  components: {
    // SubscriptionCard
    subscription: string;
    nextPayment: string;
    charges: string;
    total: string;
    createdAt: string;

    // SubscriptionActions
    pause: string;
    pausing: string;
    resume: string;
    resuming: string;
    cancel: string;
    cancelling: string;
    cancelConfirm: string;

    // SubscriptionList
    noSubscriptions: string;
    loadingSubscriptions: string;

    // BillingHistory
    billingHistory: string;
    noInvoices: string;
    loadingHistory: string;
    attempt: string;
  };

  // Common
  common: {
    loading: string;
    error: string;
    retry: string;
    close: string;
    confirm: string;
    save: string;
  };
};

// ============================================================================
// Locale Resolution
// ============================================================================

/**
 * Resolve a locale string to a supported locale
 * Falls back to base language or default locale
 */
export function resolveLocale(locale: string): SupportedLocale {
  // Exact match
  if (isSupported(locale)) {
    return locale as SupportedLocale;
  }

  // Try base language (e.g., "es-AR" -> "es")
  const baseLang = locale.split("-")[0];
  if (isSupported(baseLang)) {
    return baseLang as SupportedLocale;
  }

  // Default fallback
  return DEFAULT_LOCALE;
}

function isSupported(locale: string): boolean {
  return ["es-UY", "es", "en-US", "en"].includes(locale);
}
