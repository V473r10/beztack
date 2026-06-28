/**
 * Derived project checkout entry — Product domain.
 *
 * Custom-owned. The Template source never provides this file. A Template
 * update MUST preserve the file unchanged. It is also excluded from
 * Promotion candidacy: Custom-owned Product domain work belongs in the
 * Derived project, not in the Template source.
 */

import { processPayment } from "./payment-handler";

export interface CheckoutItem {
  readonly sku: string;
  readonly quantity: number;
}

export function startCheckout(items: readonly CheckoutItem[]): string {
  if (items.length === 0) {
    throw new Error("Cannot checkout an empty cart");
  }
  const totalCents = items.reduce(
    (sum, item) => sum + priceFor(item.sku) * item.quantity,
    0
  );
  return processPayment(totalCents);
}

function priceFor(sku: string): number {
  // Pricing belongs to the Derived project's Product domain.
  return sku.length * 100;
}
