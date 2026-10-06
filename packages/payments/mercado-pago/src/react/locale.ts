/** Locales the Mercado Pago SDK accepts for its checkout UI. */
export const MERCADO_PAGO_LOCALES = [
  "es-UY",
  "es-AR",
  "es-CL",
  "es-CO",
  "es-MX",
  "es-VE",
  "es-PE",
  "pt-BR",
  "en-US",
] as const;

export type MercadoPagoLocale = (typeof MERCADO_PAGO_LOCALES)[number];

/**
 * Map the project locale (`DEFAULT_LOCALE`) to a locale the Mercado Pago SDK
 * supports. Returns `undefined` when there is no exact match, so the SDK uses
 * its own default instead of Beztack inventing a regional one.
 */
export function resolveMercadoPagoLocale(locale: string): MercadoPagoLocale | undefined {
  const normalized = locale.toLowerCase();
  return MERCADO_PAGO_LOCALES.find((candidate) => candidate.toLowerCase() === normalized);
}
