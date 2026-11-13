import i18next, { type i18n as I18nInstance } from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json" with { type: "json" };
import es from "./locales/es.json" with { type: "json" };

export const SUPPORTED_LANGUAGES = ["en", "es"] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** Where an explicit language choice is remembered. */
export const LANGUAGE_STORAGE_KEY = "i18nextLng";

const FALLBACK_LANGUAGE: SupportedLanguage = "en";

function isSupportedLanguage(code: string): code is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(code);
}

/** The translated language for a project locale (`es-UY` -> `es`), or English. */
function languageOfLocale(locale: string): SupportedLanguage {
  const base = locale.split("-")[0]?.toLowerCase() ?? "";
  return isSupportedLanguage(base) ? base : FALLBACK_LANGUAGE;
}

function syncHtmlLang(language: string | undefined): void {
  if (typeof document !== "undefined" && language) {
    document.documentElement.lang = language;
  }
}

/**
 * Build the UI's i18n instance.
 *
 * Language priority: the visitor's explicit choice (see {@link chooseLanguage}),
 * then the browser language, then the project default locale. The detector
 * never writes storage (`caches: []`), so an unchosen language keeps following
 * the browser.
 */
export function createI18n({ defaultLocale }: { defaultLocale: string }) {
  const instance = i18next.createInstance();
  instance.on("languageChanged", syncHtmlLang);

  instance
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      initAsync: false, // bundled resources: nothing to wait for
      resources: { en: { translation: en }, es: { translation: es } },
      supportedLngs: [...SUPPORTED_LANGUAGES],
      fallbackLng: [...new Set([languageOfLocale(defaultLocale), FALLBACK_LANGUAGE])],
      detection: {
        order: ["localStorage", "navigator"],
        lookupLocalStorage: LANGUAGE_STORAGE_KEY,
        caches: [],
        // `es-UY` -> `es`, so the visitor's first preference wins over a later exact `en`.
        convertDetectedLanguage: (code: string) => code.split("-")[0] ?? code,
      },
      interpolation: {
        escapeValue: false, // react already safes from xss => https://www.i18next.com/translation-function/interpolation#unescape
      },
    });

  syncHtmlLang(instance.language);
  return instance;
}

/** Switch language because the visitor picked it, and remember the pick. */
export async function chooseLanguage(
  instance: I18nInstance,
  language: SupportedLanguage,
): Promise<void> {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Storage can be blocked (private mode); the choice then lasts for this visit.
  }
  await instance.changeLanguage(language);
}
