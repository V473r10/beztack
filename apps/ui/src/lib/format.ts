import { env } from "@/env";

/**
 * Locale-aware formatting for the UI.
 *
 * Everything defaults to the project's regional configuration
 * (`VITE_DEFAULT_LOCALE`, `VITE_DEFAULT_CURRENCY`); there is no built-in
 * regional default. A value that carries its own currency always keeps it.
 */

function projectLocale(): string {
  return env.VITE_DEFAULT_LOCALE;
}

function resolveCurrency(currency: string | null | undefined): string {
  return currency || env.VITE_DEFAULT_CURRENCY;
}

/** Number of minor-unit decimals `Intl` uses for a currency (USD 2, JPY 0, KWD 3). */
export function currencyFractionDigits(currency: string): number {
  return (
    new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
      .maximumFractionDigits ?? 0
  );
}

/**
 * Format a price in major units (e.g. `29` -> `$29.00`).
 *
 * Decimals come from `Intl` for the currency, never from a fixed count.
 * Currency precedence: the price's own `currency`, then the project default.
 */
export function formatPrice(
  amount: number | string,
  currency?: string | null,
  locale: string = projectLocale(),
): string {
  const value = typeof amount === "string" ? Number.parseFloat(amount) : amount;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: resolveCurrency(currency),
  }).format(value);
}

/** Format a date (or ISO string) in the project locale. */
export function formatDate(
  date: Date | string | number,
  options?: Intl.DateTimeFormatOptions,
  locale: string = projectLocale(),
): string {
  return new Intl.DateTimeFormat(locale, options).format(new Date(date));
}

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86_400;
const SECONDS_PER_MONTH = 2_592_000; // 30 days
const SECONDS_PER_YEAR = 31_536_000; // 365 days
const MILLISECONDS_PER_SECOND = 1000;

const RELATIVE_UNITS: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", SECONDS_PER_YEAR],
  ["month", SECONDS_PER_MONTH],
  ["day", SECONDS_PER_DAY],
  ["hour", SECONDS_PER_HOUR],
  ["minute", SECONDS_PER_MINUTE],
];

/**
 * Format a date relative to now in the project locale, e.g. "in 3 days" or
 * "2 hours ago", using the largest unit that fits.
 */
export function formatRelativeFromNow(
  date: Date | string | number,
  locale: string = projectLocale(),
): string {
  const diffSeconds = (new Date(date).getTime() - Date.now()) / MILLISECONDS_PER_SECOND;
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  for (const [unit, secondsPerUnit] of RELATIVE_UNITS) {
    if (Math.abs(diffSeconds) >= secondsPerUnit) {
      return formatter.format(Math.round(diffSeconds / secondsPerUnit), unit);
    }
  }

  return formatter.format(Math.round(diffSeconds), "second");
}
