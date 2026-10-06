import { describe, expect, it } from "vitest";
import { resolveMercadoPagoLocale } from "./locale.js";

describe("resolveMercadoPagoLocale", () => {
  it.each(["es-UY", "es-AR", "pt-BR", "en-US"])("keeps the supported locale %s", (locale) => {
    expect(resolveMercadoPagoLocale(locale)).toBe(locale);
  });

  it("matches regardless of case", () => {
    expect(resolveMercadoPagoLocale("es-mx")).toBe("es-MX");
  });

  it.each(["fr-FR", "es", "en", "de-DE"])(
    "returns undefined for %s so the SDK picks its own default",
    (locale) => {
      expect(resolveMercadoPagoLocale(locale)).toBeUndefined();
    },
  );
});
