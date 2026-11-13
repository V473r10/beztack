import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
import { createI18n } from "@/lib/i18n/create-i18n";
import type { SupportedLanguage } from "@/lib/i18n/create-i18n";

/**
 * Render a component to static HTML with the app's real translations in the
 * given language, so a test asserts what a visitor reads (not translation keys).
 */
export function renderInLanguage(language: SupportedLanguage, element: ReactElement): string {
  const instance = createI18n({ defaultLocale: language });
  instance.changeLanguage(language);
  return renderToStaticMarkup(<I18nextProvider i18n={instance}>{element}</I18nextProvider>);
}
