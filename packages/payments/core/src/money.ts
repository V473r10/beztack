/**
 * Money helpers for the price contract: an integer amount in the currency's
 * minor unit plus an ISO 4217 currency code (see ADR 0007).
 *
 * `900 USD` is US$ 9.00, `900 JPY` is ¥ 900 and `9000 KWD` is KWD 9.000.
 *
 * Browser-safe: this entry point has no dependencies and imports nothing
 * provider-specific, so the API, the UI and the payment adapters share it.
 *
 * The number of decimals of each currency comes from the ISO 4217 minor-unit
 * table below, never from the runtime's `Intl` data: CLDR differs between
 * Node versions and browsers (some builds give COP, HUF or IDR no decimals,
 * ISO 4217 gives them 2), and a disagreement would show prices 100x off.
 * `Intl` is only used to format; it is told the table's decimals.
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

/**
 * Codes of the ISO 4217 currencies (including funds codes) grouped by the
 * number of digits of their minor unit (the `CcyMnrUnts` field).
 *
 * Source: the ISO 4217 "List one" (current currency and funds codes) kept by
 * the maintenance agency SIX, published 2026-09-17:
 * https://www.six-group.com/en/products-services/financial-information/data-center/iso-currency.html
 * Codes without a minor unit (XAU, XAG, XDR, XXX, ...) are not currencies a
 * plan can be priced in and are absent. A currency ISO 4217 withdrew (SLL,
 * HRK, ZWL, ...) is absent too: it is unknown.
 *
 * `packages/db/drizzle/0009_prices_minor_units.sql` carries the same table; a
 * test fails when the two differ. Update both when ISO 4217 changes.
 */
const CURRENCIES_BY_MINOR_UNITS: ReadonlyArray<readonly [number, string]> = [
  [0, "BIF CLP DJF GNF ISK JPY KMF KRW PYG RWF UGX UYI VND VUV XAF XOF XPF"],
  [
    2,
    "AED AFN ALL AMD AOA ARS AUD AWG AZN BAM BBD BDT BMD BND BOB BOV BRL BSD BTN BWP BYN BZD CAD CDF CHE CHF CHW CNY COP COU CRC CUP CVE CZK DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GTQ GYD HKD HNL HTG HUF IDR ILS INR IRR JMD KES KGS KHR KPW KYD KZT LAK LBP LKR LRD LSL MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MXV MYR MZN NAD NGN NIO NOK NPR NZD PAB PEN PGK PHP PKR PLN QAR RON RSD RUB SAR SBD SCR SDG SEK SGD SHP SLE SOS SRD SSP STN SVC SYP SZL THB TJS TMT TOP TRY TTD TWD TZS UAH USD USN UYU UZS VED VES WST XAD XCD XCG YER ZAR ZMW ZWG",
  ],
  [3, "BHD IQD JOD KWD LYD OMR TND"],
  [4, "CLF UYW"],
];

/** Minor-unit digits by uppercase ISO 4217 code. Exported for the tests that tie it to the SQL migration. */
export const ISO_4217_MINOR_UNITS: Readonly<Record<string, number>> = Object.freeze(
  Object.fromEntries(
    CURRENCIES_BY_MINOR_UNITS.flatMap(([decimals, codes]) =>
      codes.split(" ").map((code) => [code, decimals] as const),
    ),
  ),
);

function assertMinorUnits(amount: number): void {
  if (!Number.isSafeInteger(amount)) {
    throw new RangeError(`Expected an integer amount in minor units, received ${amount}`);
  }
}

/**
 * Number of decimal places of the currency's minor unit, from ISO 4217:
 * USD 2, JPY 0, KWD 3, CLF 4. Throws a `RangeError` for a code that is not an
 * uppercase ISO 4217 code.
 */
export function currencyDecimals(currency: string): number {
  if (!CURRENCY_CODE_PATTERN.test(currency)) {
    throw new RangeError(
      `Invalid currency code ${JSON.stringify(currency)}: expected an uppercase ISO 4217 code`,
    );
  }
  const decimals = Object.hasOwn(ISO_4217_MINOR_UNITS, currency)
    ? ISO_4217_MINOR_UNITS[currency]
    : undefined;
  if (decimals === undefined) {
    throw new RangeError(
      `Unknown currency code ${JSON.stringify(currency)}: it is not in the ISO 4217 table`,
    );
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
  // The decimals come from the ISO 4217 table, not from this runtime's CLDR.
  const decimals = currencyDecimals(currency);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(minorToMajor(minor, currency));
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
