import { z } from "zod";

/**
 * Project-level regional configuration shared by the API and UI env schemas.
 *
 * Beztack carries no regional default: a Derived project picks its currency
 * and locale when it is scaffolded (the `create` CLI writes them to the env),
 * and the apps refuse to start without them.
 */

const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;

function isSupportedCurrency(code: string): boolean {
  return Intl.supportedValuesOf("currency").includes(code);
}

function isWellFormedLocale(locale: string): boolean {
  try {
    return Intl.getCanonicalLocales(locale).length === 1;
  } catch {
    return false;
  }
}

/** An ISO 4217 currency code known to `Intl`, e.g. `USD`, `UYU`, `JPY`. */
export const CURRENCY_CODE_SCHEMA = z
  .string()
  .regex(CURRENCY_CODE_PATTERN, "Must be an uppercase ISO 4217 currency code, e.g. USD")
  .refine(isSupportedCurrency, "Unknown ISO 4217 currency code");

/** A BCP 47 locale tag, e.g. `en-US`, `es-UY`. */
export const LOCALE_SCHEMA = z
  .string()
  .min(1)
  .refine(isWellFormedLocale, "Must be a BCP 47 locale tag, e.g. en-US");
