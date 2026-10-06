/**
 * Project regional defaults asked by `create` and written to the project env.
 *
 * Beztack has no built-in currency or locale: the Derived project picks them
 * once, and the API and UI refuse to start without them. Validation mirrors
 * `@beztack/env` (ISO 4217 code known to Intl, BCP 47 locale tag).
 */

export interface RegionalDefaults {
  /** ISO 4217 code, e.g. "USD". Written as DEFAULT_CURRENCY / VITE_DEFAULT_CURRENCY. */
  currency: string;
  /** BCP 47 tag, e.g. "en-US". Written as DEFAULT_LOCALE / VITE_DEFAULT_LOCALE. */
  locale: string;
}

const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;

export function normalizeCurrencyCode(value: string): string {
  return value.trim().toUpperCase();
}

/** Returns an error message, or undefined when `value` is a valid currency code. */
export function validateCurrencyCode(value: string | undefined): string | undefined {
  const code = normalizeCurrencyCode(value ?? "");
  if (!code) {
    return "Default currency is required (ISO 4217 code, e.g. USD)";
  }
  if (!(CURRENCY_CODE_PATTERN.test(code) && Intl.supportedValuesOf("currency").includes(code))) {
    return `"${value}" is not an ISO 4217 currency code (e.g. USD, EUR, UYU)`;
  }
  return;
}

/** Returns an error message, or undefined when `value` is a valid locale tag. */
export function validateLocale(value: string | undefined): string | undefined {
  const locale = (value ?? "").trim();
  if (!locale) {
    return "Default locale is required (BCP 47 tag, e.g. en-US)";
  }
  try {
    if (Intl.getCanonicalLocales(locale).length === 1) {
      return;
    }
  } catch {
    // fall through
  }
  return `"${value}" is not a BCP 47 locale tag (e.g. en-US, es-UY, pt-BR)`;
}

/**
 * Validate and normalize regional defaults, throwing on the first problem.
 * Used by non-interactive `create`, which has no prompt to fall back on.
 */
export function requireRegionalDefaults(input: {
  currency?: string;
  locale?: string;
}): RegionalDefaults {
  const currencyError = validateCurrencyCode(input.currency);
  if (currencyError) {
    throw new Error(`${currencyError}. Pass --currency <code>.`);
  }
  const localeError = validateLocale(input.locale);
  if (localeError) {
    throw new Error(`${localeError}. Pass --locale <tag>.`);
  }
  return {
    currency: normalizeCurrencyCode(input.currency ?? ""),
    locale: (input.locale ?? "").trim(),
  };
}

const CURRENCY_LINE = /^((?:VITE_)?DEFAULT_CURRENCY)=.*$/gm;
const LOCALE_LINE = /^((?:VITE_)?DEFAULT_LOCALE)=.*$/gm;

/**
 * Fill the regional default entries of an env file (`DEFAULT_CURRENCY=`,
 * `VITE_DEFAULT_LOCALE=`, ...). Other lines, including comments, are untouched.
 */
export function applyRegionalDefaults(content: string, defaults: RegionalDefaults): string {
  return content
    .replace(CURRENCY_LINE, (_line, name: string) => `${name}=${defaults.currency}`)
    .replace(LOCALE_LINE, (_line, name: string) => `${name}=${defaults.locale}`);
}
