/**
 * Derived project payment handler — Product domain.
 *
 * Custom-owned. Stub implementation for the Derived project's payment
 * processor. The Template source never provides this file. Promotion
 * metadata must classify it as custom-owned-product-domain and skip it.
 */

export function processPayment(amountCents: number): string {
  if (amountCents <= 0) {
    throw new Error("Amount must be positive");
  }
  return `pay_${amountCents}_${Date.now().toString(36)}`;
}
