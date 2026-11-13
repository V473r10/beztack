import type { i18n as I18nInstance } from "i18next";

type TranslateSource = Pick<I18nInstance, "t">;

let source: TranslateSource | undefined;

/**
 * Tells `translate` which i18n instance holds the user's language, so code that runs outside
 * React (mutation callbacks, file downloads) can still write in that language.
 */
export function setTranslateSource(next: TranslateSource | undefined): void {
  source = next;
}

/** Translate outside a component. Without an instance (tests, before start-up) the key comes back. */
export function translate(key: string, options?: Record<string, unknown>): string {
  return source ? String(options ? source.t(key, options) : source.t(key)) : key;
}
