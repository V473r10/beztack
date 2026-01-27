import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  formatFrequencyLocalized,
  formatPriceLocalized,
  getPaymentStatusLabel,
  getPlanStatusLabel,
  getSubscriptionStatusLabel,
  getTranslations,
  resolveLocale,
  t,
} from "./index.js";

// Test constants for frequency values
const FREQUENCY_QUARTERLY = 3;
const FREQUENCY_BIANNUAL = 6;
const FREQUENCY_WEEKLY = 7;
const FREQUENCY_MONTHLY_DAYS = 30;

// Test constants for price values
const PRICE_UYU = 1500;
const PRICE_USD = 99.99;
const PRICE_STRING = "250.50";
const PRICE_INTEGER = 100;

describe("i18n", () => {
  describe("resolveLocale", () => {
    it("returns exact match for supported locales", () => {
      expect(resolveLocale("es-UY")).toBe("es-UY");
      expect(resolveLocale("es")).toBe("es");
      expect(resolveLocale("en-US")).toBe("en-US");
      expect(resolveLocale("en")).toBe("en");
    });

    it("falls back to base language for unsupported regional variants", () => {
      expect(resolveLocale("es-AR")).toBe("es");
      expect(resolveLocale("es-MX")).toBe("es");
      expect(resolveLocale("en-GB")).toBe("en");
      expect(resolveLocale("en-AU")).toBe("en");
    });

    it("falls back to default locale for unsupported languages", () => {
      expect(resolveLocale("fr")).toBe(DEFAULT_LOCALE);
      expect(resolveLocale("de-DE")).toBe(DEFAULT_LOCALE);
      expect(resolveLocale("pt-BR")).toBe(DEFAULT_LOCALE);
    });
  });

  describe("getTranslations", () => {
    it("returns Spanish translations by default", () => {
      const trans = getTranslations();
      expect(trans.paymentStatus.approved).toBe("Aprobado");
      expect(trans.subscriptionStatus.active).toBe("Activa");
    });

    it("returns English translations for en locale", () => {
      const trans = getTranslations("en");
      expect(trans.paymentStatus.approved).toBe("Approved");
      expect(trans.subscriptionStatus.active).toBe("Active");
    });

    it("returns Spanish translations for es-UY locale", () => {
      const trans = getTranslations("es-UY");
      expect(trans.paymentStatus.pending).toBe("Pendiente");
    });
  });

  describe("t function", () => {
    it("returns translation for valid path", () => {
      expect(t("es", "paymentStatus.approved")).toBe("Aprobado");
      expect(t("en", "paymentStatus.approved")).toBe("Approved");
    });

    it("returns path when translation not found", () => {
      expect(t("es", "nonexistent.path")).toBe("nonexistent.path");
    });

    it("replaces params in translation strings", () => {
      const result = t("es", "frequency.everyN", { n: 3, unit: "meses" });
      expect(result).toBe("cada 3 meses");
    });

    it("handles deep nested paths", () => {
      expect(t("es", "components.billingHistory")).toBe(
        "Historial de Facturación"
      );
      expect(t("en", "components.billingHistory")).toBe("Billing History");
    });
  });

  describe("getPaymentStatusLabel", () => {
    it("returns correct Spanish labels", () => {
      expect(getPaymentStatusLabel("approved", "es")).toBe("Aprobado");
      expect(getPaymentStatusLabel("pending", "es")).toBe("Pendiente");
      expect(getPaymentStatusLabel("rejected", "es")).toBe("Rechazado");
      expect(getPaymentStatusLabel("refunded", "es")).toBe("Reembolsado");
    });

    it("returns correct English labels", () => {
      expect(getPaymentStatusLabel("approved", "en")).toBe("Approved");
      expect(getPaymentStatusLabel("pending", "en")).toBe("Pending");
      expect(getPaymentStatusLabel("rejected", "en")).toBe("Rejected");
      expect(getPaymentStatusLabel("refunded", "en")).toBe("Refunded");
    });

    it("returns status as-is for unknown statuses", () => {
      expect(getPaymentStatusLabel("unknown_status", "es")).toBe(
        "unknown_status"
      );
    });
  });

  describe("getSubscriptionStatusLabel", () => {
    it("returns correct Spanish labels", () => {
      expect(getSubscriptionStatusLabel("active", "es")).toBe("Activa");
      expect(getSubscriptionStatusLabel("paused", "es")).toBe("Pausada");
      expect(getSubscriptionStatusLabel("cancelled", "es")).toBe("Cancelada");
    });

    it("returns correct English labels", () => {
      expect(getSubscriptionStatusLabel("active", "en")).toBe("Active");
      expect(getSubscriptionStatusLabel("paused", "en")).toBe("Paused");
      expect(getSubscriptionStatusLabel("cancelled", "en")).toBe("Cancelled");
    });
  });

  describe("getPlanStatusLabel", () => {
    it("returns correct Spanish labels", () => {
      expect(getPlanStatusLabel("active", "es")).toBe("Activo");
      expect(getPlanStatusLabel("inactive", "es")).toBe("Inactivo");
    });

    it("returns correct English labels", () => {
      expect(getPlanStatusLabel("active", "en")).toBe("Active");
      expect(getPlanStatusLabel("inactive", "en")).toBe("Inactive");
    });
  });

  describe("formatFrequencyLocalized", () => {
    it("formats monthly frequency in Spanish", () => {
      expect(formatFrequencyLocalized(1, "months", "es")).toBe("cada mes");
      expect(
        formatFrequencyLocalized(FREQUENCY_QUARTERLY, "months", "es")
      ).toBe("cada 3 meses");
      expect(formatFrequencyLocalized(FREQUENCY_BIANNUAL, "months", "es")).toBe(
        "cada 6 meses"
      );
    });

    it("formats daily frequency in Spanish", () => {
      expect(formatFrequencyLocalized(1, "days", "es")).toBe("cada día");
      expect(formatFrequencyLocalized(FREQUENCY_WEEKLY, "days", "es")).toBe(
        "cada 7 días"
      );
      expect(
        formatFrequencyLocalized(FREQUENCY_MONTHLY_DAYS, "days", "es")
      ).toBe("cada 30 días");
    });

    it("formats monthly frequency in English", () => {
      expect(formatFrequencyLocalized(1, "months", "en")).toBe("every month");
      expect(
        formatFrequencyLocalized(FREQUENCY_QUARTERLY, "months", "en")
      ).toBe("every 3 months");
    });

    it("formats daily frequency in English", () => {
      expect(formatFrequencyLocalized(1, "days", "en")).toBe("every day");
      expect(formatFrequencyLocalized(FREQUENCY_WEEKLY, "days", "en")).toBe(
        "every 7 days"
      );
    });
  });

  describe("formatPriceLocalized", () => {
    it("formats UYU currency correctly", () => {
      const result = formatPriceLocalized(PRICE_UYU, "UYU", "es-UY");
      expect(result).toContain("1");
      expect(result).toContain("500");
    });

    it("formats USD currency correctly", () => {
      const result = formatPriceLocalized(PRICE_USD, "USD", "en-US");
      expect(result).toContain("$");
      expect(result).toContain("99");
    });

    it("handles string amounts", () => {
      const result = formatPriceLocalized(PRICE_STRING, "UYU", "es");
      expect(result).toContain("250");
    });

    it("handles integer amounts without decimals", () => {
      const result = formatPriceLocalized(PRICE_INTEGER, "USD", "en");
      expect(result).toContain("100");
    });
  });
});
