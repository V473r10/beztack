/**
 * Money helpers for the price contract: an integer amount in the currency's
 * minor unit plus an ISO 4217 currency code (see ADR 0007).
 *
 * `900 USD` is US$ 9.00, `900 JPY` is ¥ 900 and `9000 KWD` is KWD 9.000.
 *
 * Browser-safe: this entry point has no dependencies and imports nothing
 * provider-specific, so the API, the UI and the payment adapters share it.
 * The number of decimals of each currency comes from `Intl`, not from a table
 * of our own.
 */

/** An amount of money: integer minor units of an ISO 4217 currency. */
export interface Money {
  /** Integer amount in the currency's minor unit. */
  readonly amount: number;
  /** Uppercase ISO 4217 currency code. */
  readonly currency: string;
}

/**
 * How `majorToMinor` resolves an amount that falls between two minor units.
 * There is no default: the caller states what the rounding means for money.
 */
export type MoneyRounding = "half-away-from-zero" | "floor" | "ceil";

export interface MajorToMinorOptions {
  readonly rounding: MoneyRounding;
}

const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;

/**
 * Binary floating point stores `1.005 * 100` as `100.49999999999999`. Fifteen
 * significant digits is the most a double holds reliably, so we round the
 * scaled value to that precision before applying the requested rounding.
 */
const SIGNIFICANT_DIGITS = 15;

let supportedCurrencies: ReadonlySet<string> | undefined;
const decimalsByCurrency = new Map<string, number>();

function assertCurrency(currency: string): void {
  if (!CURRENCY_CODE_PATTERN.test(currency)) {
    throw new RangeError(
      `Invalid currency code ${JSON.stringify(currency)}: expected an uppercase ISO 4217 code`,
    );
  }
  supportedCurrencies ??= new Set(Intl.supportedValuesOf("currency"));
  if (!supportedCurrencies.has(currency)) {
    throw new RangeError(`Unknown currency code ${JSON.stringify(currency)}`);
  }
}

function assertMinorUnits(amount: number): void {
  if (!Number.isSafeInteger(amount)) {
    throw new RangeError(`Expected an integer amount in minor units, received ${amount}`);
  }
}

/** Number of decimal places of the currency's minor unit: USD 2, JPY 0, KWD 3. */
export function currencyDecimals(currency: string): number {
  assertCurrency(currency);
  let decimals = decimalsByCurrency.get(currency);
  if (decimals === undefined) {
    const resolved = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits;
    if (resolved === undefined) {
      throw new RangeError(`Cannot resolve the decimals of currency ${currency}`);
    }
    decimals = resolved;
    decimalsByCurrency.set(currency, decimals);
  }
  return decimals;
}

/** Converts integer minor units to a major-unit number: `1999 USD` -> `19.99`. */
export function minorToMajor(minor: number, currency: string): number {
  assertMinorUnits(minor);
  return minor / 10 ** currencyDecimals(currency);
}

function applyRounding(value: number, rounding: MoneyRounding): number {
  switch (rounding) {
    case "floor":
      return Math.floor(value);
    case "ceil":
      return Math.ceil(value);
    case "half-away-from-zero":
      return Math.sign(value) * Math.round(Math.abs(value));
  }
}

/**
 * Converts a major-unit number to integer minor units: `19.99 USD` -> `1999`.
 *
 * `rounding` is required because the right choice depends on the caller (a
 * price the customer pays versus a credit we owe them).
 */
export function majorToMinor(
  major: number,
  currency: string,
  options: MajorToMinorOptions,
): number {
  if (!Number.isFinite(major)) {
    throw new RangeError(`Expected a finite amount, received ${major}`);
  }
  const scaled = Number((major * 10 ** currencyDecimals(currency)).toPrecision(SIGNIFICANT_DIGITS));
  const minor = applyRounding(scaled, options.rounding) + 0; // `+ 0` turns -0 into 0
  if (!Number.isSafeInteger(minor)) {
    throw new RangeError(`Amount ${major} ${currency} does not fit in safe integer minor units`);
  }
  return minor;
}

/**
 * Formats integer minor units for display in the given BCP 47 locale. The
 * locale is the language the user chose; it never changes the amount.
 */
export function formatMinorUnits(minor: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(
    minorToMajor(minor, currency),
  );
}

/**
 * Takes `numerator / denominator` of an integer amount of minor units, in
 * integers only: `prorateMinorUnits(2900, 15, 30)` is `1450`.
 *
 * Rounding: to the nearest minor unit, ties away from zero. For a customer
 * credit that is a difference of at most half a minor unit (US$ 0.005), and
 * both a Plan change preview and the payment it produces use this one rule,
 * so they never disagree. `numerator` and `denominator` are counts (days),
 * not money.
 */
export function prorateMinorUnits(amount: number, numerator: number, denominator: number): number {
  assertMinorUnits(amount);
  if (!Number.isSafeInteger(numerator) || numerator < 0) {
    throw new RangeError(`Expected a non-negative integer numerator, received ${numerator}`);
  }
  if (!Number.isSafeInteger(denominator) || denominator <= 0) {
    throw new RangeError(`Expected a positive integer denominator, received ${denominator}`);
  }
  // `2 * |amount| * numerator + denominator` is the largest intermediate value.
  const scaled = 2 * Math.abs(amount) * numerator + denominator;
  if (!Number.isSafeInteger(scaled)) {
    throw new RangeError(`Prorating ${amount} by ${numerator}/${denominator} overflows`);
  }
  const rounded = Math.floor(scaled / (2 * denominator));
  return Math.sign(amount) * rounded + 0; // `+ 0` turns -0 into 0
}
