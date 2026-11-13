import { afterEach, describe, expect, it, vi } from "vitest";
import { chooseLanguage, createI18n, LANGUAGE_STORAGE_KEY } from "./create-i18n";

type Browser = {
  stored?: string;
  languages?: string[];
};

/** Stubs the browser globals the language detector reads and the html element. */
function stubBrowser({ stored, languages = [] }: Browser = {}) {
  const store = new Map<string, string>();
  if (stored) {
    store.set(LANGUAGE_STORAGE_KEY, stored);
  }
  const localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
  const documentElement = { lang: "" };
  vi.stubGlobal("window", { localStorage, location: { search: "", pathname: "/", hash: "" } });
  vi.stubGlobal("navigator", { languages, language: languages[0] });
  vi.stubGlobal("document", { documentElement });
  return { store, documentElement };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("language detection", () => {
  it("uses the explicit choice over the browser language", async () => {
    stubBrowser({ stored: "es", languages: ["en-US"] });
    const i18n = createI18n({ defaultLocale: "en-US" });
    expect(i18n.language).toBe("es");
  });

  it("uses the browser language when the visitor never chose", async () => {
    stubBrowser({ languages: ["es-UY", "en"] });
    const i18n = createI18n({ defaultLocale: "en-US" });
    expect(i18n.language).toBe("es");
  });

  it("falls back to the project default locale when the browser language is unsupported", async () => {
    stubBrowser({ languages: ["fr-FR"] });
    const i18n = createI18n({ defaultLocale: "es-UY" });
    expect(i18n.language).toBe("es");
  });

  it("falls back to English when the project default locale has no translations", async () => {
    stubBrowser({ languages: ["fr-FR"] });
    const i18n = createI18n({ defaultLocale: "ja-JP" });
    expect(i18n.language).toBe("en");
  });

  it("ignores a stored language that is not supported", async () => {
    stubBrowser({ stored: "xx", languages: ["es"] });
    const i18n = createI18n({ defaultLocale: "en-US" });
    expect(i18n.language).toBe("es");
  });

  it("does not write the detected language to storage", async () => {
    const { store } = stubBrowser({ languages: ["es"] });
    createI18n({ defaultLocale: "en-US" });
    expect(store.has(LANGUAGE_STORAGE_KEY)).toBe(false);
  });
});

describe("chooseLanguage", () => {
  it("switches the language and remembers it", async () => {
    const { store } = stubBrowser({ languages: ["en"] });
    const i18n = createI18n({ defaultLocale: "en-US" });

    await chooseLanguage(i18n, "es");

    expect(i18n.language).toBe("es");
    expect(store.get(LANGUAGE_STORAGE_KEY)).toBe("es");
  });

  it("is remembered by the next page load", async () => {
    const { store } = stubBrowser({ languages: ["en"] });
    const first = createI18n({ defaultLocale: "en-US" });
    await chooseLanguage(first, "es");

    stubBrowser({ stored: store.get(LANGUAGE_STORAGE_KEY), languages: ["en"] });
    const reloaded = createI18n({ defaultLocale: "en-US" });
    expect(reloaded.language).toBe("es");
  });
});

describe("html lang", () => {
  it("is set at startup and follows language changes", async () => {
    const { documentElement } = stubBrowser({ languages: ["es-UY"] });
    const i18n = createI18n({ defaultLocale: "en-US" });
    expect(documentElement.lang).toBe("es");

    await chooseLanguage(i18n, "en");
    expect(documentElement.lang).toBe("en");
  });
});
