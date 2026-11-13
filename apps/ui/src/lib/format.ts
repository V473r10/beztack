import { formatMinorUnits, majorToMinor } from "@beztack/payments/money";
import i18n from "i18next";
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

/**
 * The language the user chose, as a BCP 47 tag for `Intl`. When the project
 * locale is a region of that same language (`es` and `es-UY`), the region
 * wins, so "US$ 9,00" reads the way the project's market writes it. Before
 * i18n is initialised (tests, first paint) the project locale applies.
 */
function activeLocale(): string {
  const language = i18n.resolvedLanguage || i18n.language;
  const project = projectLocale();
  if (!language) {
    return project;
  }
  const projectLanguage = project?.split("-")[0];
  return projectLanguage === language ? project : language;
}

/**
 * Format a price given as integer minor units plus a currency code
 * (`900`, `"USD"` -> `$9.00` in English, `US$ 9,00` in Spanish; ADR 0007).
 *
 * The language is the active i18n language unless `locale` says otherwise.
 * Currency precedence: the price's own `currency`, then the project default.
 */
export function formatPrice(
  amount: number,
  currency?: string | null,
  locale: string = activeLocale(),
): string {
  return formatMinorUnits(amount, resolveCurrency(currency), locale);
}

/**
 * Format a decimal amount read straight from a Mercado Pago payload
 * (`transaction_amount: 9.99`, or the same as a string in a webhook event).
 * Mercado Pago is the one provider that still speaks major units, so this is
 * the UI's edge for its raw data: it converts once to minor units and formats
 * like any other price. Prices from Beztack's own API never go through here.
 */
export function formatMercadoPagoAmount(
  amount: number | string,
  currency?: string | null,
  locale: string = activeLocale(),
): string {
  const major = typeof amount === "string" ? Number.parseFloat(amount) : amount;
  const resolved = resolveCurrency(currency);
  return formatPrice(
    majorToMinor(major, resolved, { rounding: "half-away-from-zero" }),
    resolved,
    locale,
  );
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
