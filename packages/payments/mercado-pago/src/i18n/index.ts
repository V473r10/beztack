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
 * Get translations for a specific locale
 */
export function getTranslations(
  locale: string = DEFAULT_LOCALE
): TranslationKeys {
  const resolved = resolveLocale(locale);
  return translations[resolved];
}

/**
 * Get a specific translation value by path
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
 * Get payment status label
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
 * Get subscription status label
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
 * Get plan status label
 */
export function getPlanStatusLabel(
  status: string,
  locale: string = DEFAULT_LOCALE
): string {
  const trans = getTranslations(locale);
  return trans.planStatus[status as keyof typeof trans.planStatus] || status;
}

/**
 * Format frequency with localized labels
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
 * Format price with locale-specific formatting
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
