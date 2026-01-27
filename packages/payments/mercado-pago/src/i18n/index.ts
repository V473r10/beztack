import { en, enUS } from "./locales/en.js";
import { es, esUY } from "./locales/es.js";
import {
  DEFAULT_LOCALE,
  resolveLocale,
  type SupportedLocale,
  type TranslationKeys,
} from "./types.js";

// ============================================================================
// Translations Registry
// ============================================================================

const translations: Record<SupportedLocale, TranslationKeys> = {
  es,
  "es-UY": esUY,
  en,
  "en-US": enUS,
};

// ============================================================================
// Translation Functions
// ============================================================================

/**
 * Get the complete translations object for a specific locale
 *
 * @param locale - Locale string (e.g., "es", "es-UY", "en", "en-US")
 * @returns Complete translations object for the resolved locale
 *
 * @example
 * ```typescript
 * const t = getTranslations("es")
 * console.log(t.paymentStatus.approved) // "Aprobado"
 * console.log(t.components.billingHistory) // "Historial de Facturación"
 * ```
 */
export function getTranslations(
  locale: string = DEFAULT_LOCALE
): TranslationKeys {
  const resolved = resolveLocale(locale);
  return translations[resolved];
}

/**
 * Get a specific translation value by dot-notation path
 *
 * @param locale - Locale string
 * @param path - Dot-notation path to the translation (e.g., "components.billingHistory")
 * @param params - Optional parameters to interpolate into the string
 * @returns Translated string, or the path if translation not found
 *
 * @example
 * ```typescript
 * // Simple translation
 * t("es", "components.billingHistory") // "Historial de Facturación"
 * t("en", "components.billingHistory") // "Billing History"
 *
 * // With parameters
 * t("es", "frequency.everyN", { n: 3, unit: "meses" }) // "cada 3 meses"
 *
 * // Returns path if not found
 * t("es", "nonexistent.path") // "nonexistent.path"
 * ```
 */
export function t(
  locale: string,
  path: string,
  params?: Record<string, string | number>
): string {
  const trans = getTranslations(locale);
  const keys = path.split(".");
  let value: unknown = trans;

  for (const key of keys) {
    if (value && typeof value === "object" && key in value) {
      value = (value as Record<string, unknown>)[key];
    } else {
      return path; // Return path if not found
    }
  }

  if (typeof value !== "string") {
    return path;
  }

  // Replace params like {n}, {unit}
  if (params) {
    return Object.entries(params).reduce(
      (str, [key, val]) =>
        str.replace(new RegExp(`\\{${key}\\}`, "g"), String(val)),
      value
    );
  }

  return value;
}

// ============================================================================
// Specialized Translation Functions
// ============================================================================

/**
 * Get localized label for a payment status
 *
 * @param status - Payment status code (e.g., "approved", "pending", "rejected")
 * @param locale - Locale string (default: "es-UY")
 * @returns Localized status label
 *
 * @example
 * ```typescript
 * getPaymentStatusLabel("approved", "es") // "Aprobado"
 * getPaymentStatusLabel("approved", "en") // "Approved"
 * getPaymentStatusLabel("rejected", "es") // "Rechazado"
 * getPaymentStatusLabel("unknown")        // "unknown" (returns as-is)
 * ```
 */
export function getPaymentStatusLabel(
  status: string,
  locale: string = DEFAULT_LOCALE
): string {
  const trans = getTranslations(locale);
  return (
    trans.paymentStatus[status as keyof typeof trans.paymentStatus] || status
  );
}

/**
 * Get localized label for a subscription status
 *
 * @param status - Subscription status code (e.g., "active", "paused", "cancelled")
 * @param locale - Locale string (default: "es-UY")
 * @returns Localized status label
 *
 * @example
 * ```typescript
 * getSubscriptionStatusLabel("active", "es")    // "Activa"
 * getSubscriptionStatusLabel("active", "en")    // "Active"
 * getSubscriptionStatusLabel("paused", "es")    // "Pausada"
 * getSubscriptionStatusLabel("cancelled", "en") // "Cancelled"
 * ```
 */
export function getSubscriptionStatusLabel(
  status: string,
  locale: string = DEFAULT_LOCALE
): string {
  const trans = getTranslations(locale);
  return (
    trans.subscriptionStatus[status as keyof typeof trans.subscriptionStatus] ||
    status
  );
}

/**
 * Get localized label for a plan status
 *
 * @param status - Plan status code ("active" | "inactive")
 * @param locale - Locale string (default: "es-UY")
 * @returns Localized status label
 *
 * @example
 * ```typescript
 * getPlanStatusLabel("active", "es")   // "Activo"
 * getPlanStatusLabel("inactive", "en") // "Inactive"
 * ```
 */
export function getPlanStatusLabel(
  status: string,
  locale: string = DEFAULT_LOCALE
): string {
  const trans = getTranslations(locale);
  return trans.planStatus[status as keyof typeof trans.planStatus] || status;
}

/**
 * Format billing frequency with localized labels
 *
 * @param frequency - Frequency number (e.g., 1, 3, 6)
 * @param frequencyType - Frequency type ("days" | "months")
 * @param locale - Locale string (default: "es-UY")
 * @returns Formatted frequency string
 *
 * @example
 * ```typescript
 * formatFrequencyLocalized(1, "months", "es") // "cada mes"
 * formatFrequencyLocalized(3, "months", "es") // "cada 3 meses"
 * formatFrequencyLocalized(1, "days", "en")   // "every day"
 * formatFrequencyLocalized(7, "days", "en")   // "every 7 days"
 * ```
 */
export function formatFrequencyLocalized(
  frequency: number,
  frequencyType: string,
  locale: string = DEFAULT_LOCALE
): string {
  const trans = getTranslations(locale);
  const { day, days, month, months, every } = trans.frequency;

  const isPlural = frequency > 1;
  let unit: string;

  if (frequencyType === "months") {
    unit = isPlural ? months : month;
  } else {
    unit = isPlural ? days : day;
  }

  if (frequency === 1) {
    return `${every} ${unit}`;
  }

  return trans.frequency.everyN
    .replace("{n}", String(frequency))
    .replace("{unit}", unit);
}

/**
 * Format price amount with locale-specific currency formatting
 *
 * @param amount - Price amount (number or string)
 * @param currencyId - ISO currency code (e.g., "UYU", "USD", "ARS")
 * @param locale - Locale string (default: "es-UY")
 * @returns Formatted price string with currency symbol
 *
 * @example
 * ```typescript
 * formatPriceLocalized(1500, "UYU", "es-UY")  // "$ 1.500"
 * formatPriceLocalized(99.99, "USD", "en-US") // "$99.99"
 * formatPriceLocalized("250.50", "UYU", "es") // "$ 250,50"
 * ```
 */
export function formatPriceLocalized(
  amount: number | string,
  currencyId: string,
  locale: string = DEFAULT_LOCALE
): string {
  const numAmount =
    typeof amount === "string" ? Number.parseFloat(amount) : amount;

  // Map locale to Intl locale
  const intlLocale = locale === "es-UY" || locale === "es" ? "es-UY" : "en-US";

  return new Intl.NumberFormat(intlLocale, {
    style: "currency",
    currency: currencyId,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numAmount);
}

// ============================================================================
// Re-exports
// ============================================================================

export type { SupportedLocale, TranslationKeys } from "./types.js";
export { DEFAULT_LOCALE, resolveLocale } from "./types.js";
