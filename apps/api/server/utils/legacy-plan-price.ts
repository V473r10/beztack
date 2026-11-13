/**
 * SHIM, removed by BZ-119 ("quitar la forma vieja").
 *
 * `plan.price` and the price inside a Pending Plan change snapshot are stored
 * as integer minor units (ADR 0007). Until the payment adapters and the Plan
 * change math move to that contract (BZ-114) and the UI stops converting
 * (BZ-119), every reader still expects the old provider-specific unit:
 *
 * - Polar: integer cents. Same as minor units, so nothing changes.
 * - Mercado Pago: decimal major units (`4500` is $ 4500). The stored minor
 *   units are divided by 10^decimals on the way out and multiplied on the way
 *   in.
 * - Any other provider: passed through; its old unit was never defined.
 *
 * Only this file knows about the old convention, so deleting the shim means
 * deleting this file and the call sites that import it.
 */
import { majorToMinor, minorToMajor } from "@beztack/payments/money";

const MERCADO_PAGO = "mercadopago";

/** The stored price (minor units) in the unit the readers still expect. */
export function legacyAmountFromPlanPrice(
  price: number,
  currency: string,
  provider: string,
): number {
  return provider === MERCADO_PAGO ? minorToMajor(price, currency) : price;
}

/** An amount in the old unit, as integer minor units for storage. */
export function planPriceFromLegacyAmount(
  amount: number,
  currency: string,
  provider: string,
): number {
  return provider === MERCADO_PAGO
    ? majorToMinor(amount, currency, { rounding: "half-away-from-zero" })
    : Math.round(amount);
}

/** A `plan` row with `price` in the old unit. */
export function withLegacyPlanPrice<
  T extends { provider: string; currency: string; price: number },
>(row: T): T {
  return { ...row, price: legacyAmountFromPlanPrice(row.price, row.currency, row.provider) };
}

type SnapshotWithPrice = {
  paymentProvider: string;
  price: { amount: number; currency: string };
};

/** A stored Pending Plan change snapshot with its price in the old unit. */
export function withLegacySnapshotPrice<T extends SnapshotWithPrice>(snapshot: T): T {
  const { amount, currency } = snapshot.price;
  return {
    ...snapshot,
    price: {
      ...snapshot.price,
      amount: legacyAmountFromPlanPrice(amount, currency, snapshot.paymentProvider),
    },
  };
}

/** A snapshot built from old-unit catalog plans, ready to store in minor units. */
export function withMinorSnapshotPrice<T extends SnapshotWithPrice>(snapshot: T): T {
  const { amount, currency } = snapshot.price;
  return {
    ...snapshot,
    price: {
      ...snapshot.price,
      amount: planPriceFromLegacyAmount(amount, currency, snapshot.paymentProvider),
    },
  };
}
