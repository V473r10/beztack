import { describe, expect, it } from "vitest";
import {
  getPaymentStatusConfig,
  getSubscriptionStatusConfig,
} from "./status-badge.js";

describe("react/components/status-badge", () => {
  describe("getPaymentStatusConfig", () => {
    describe("Spanish locale (default)", () => {
      it("returns correct config for approved status", () => {
        const config = getPaymentStatusConfig("approved");

        expect(config.label).toBe("Aprobado");
        expect(config.color).toBe("text-green-700");
        expect(config.bgColor).toBe("bg-green-100");
        expect(config.borderColor).toBe("border-green-300");
      });

      it("returns correct config for pending status", () => {
        const config = getPaymentStatusConfig("pending");

        expect(config.label).toBe("Pendiente");
        expect(config.color).toBe("text-yellow-700");
        expect(config.bgColor).toBe("bg-yellow-100");
      });

      it("returns correct config for rejected status", () => {
        const config = getPaymentStatusConfig("rejected");

        expect(config.label).toBe("Rechazado");
        expect(config.color).toBe("text-red-700");
        expect(config.bgColor).toBe("bg-red-100");
      });

      it("returns correct config for refunded status", () => {
        const config = getPaymentStatusConfig("refunded");

        expect(config.label).toBe("Reembolsado");
        expect(config.color).toBe("text-blue-700");
        expect(config.bgColor).toBe("bg-blue-100");
      });

      it("returns correct config for in_process status", () => {
        const config = getPaymentStatusConfig("in_process");

        expect(config.label).toBe("En proceso");
        expect(config.color).toBe("text-yellow-700");
      });

      it("returns correct config for in_mediation status", () => {
        const config = getPaymentStatusConfig("in_mediation");

        expect(config.label).toBe("En mediación");
        expect(config.color).toBe("text-orange-700");
      });

      it("returns correct config for charged_back status", () => {
        const config = getPaymentStatusConfig("charged_back");

        expect(config.label).toBe("Contracargo");
        expect(config.color).toBe("text-red-700");
      });
    });

    describe("English locale", () => {
      it("returns correct config for approved status", () => {
        const config = getPaymentStatusConfig("approved", "en");

        expect(config.label).toBe("Approved");
        expect(config.color).toBe("text-green-700");
      });

      it("returns correct config for pending status", () => {
        const config = getPaymentStatusConfig("pending", "en");

        expect(config.label).toBe("Pending");
      });

      it("returns correct config for rejected status", () => {
        const config = getPaymentStatusConfig("rejected", "en");

        expect(config.label).toBe("Rejected");
      });
    });

    it("returns default styling for unknown status", () => {
      const config = getPaymentStatusConfig("unknown_status");

      expect(config.label).toBe("unknown_status");
      expect(config.color).toBe("text-gray-700");
      expect(config.bgColor).toBe("bg-gray-100");
      expect(config.borderColor).toBe("border-gray-300");
    });
  });

  describe("getSubscriptionStatusConfig", () => {
    describe("Spanish locale (default)", () => {
      it("returns correct config for active status", () => {
        const config = getSubscriptionStatusConfig("active");

        expect(config.label).toBe("Activa");
        expect(config.color).toBe("text-green-700");
        expect(config.bgColor).toBe("bg-green-100");
        expect(config.borderColor).toBe("border-green-300");
      });

      it("returns correct config for paused status", () => {
        const config = getSubscriptionStatusConfig("paused");

        expect(config.label).toBe("Pausada");
        expect(config.color).toBe("text-orange-700");
        expect(config.bgColor).toBe("bg-orange-100");
      });

      it("returns correct config for cancelled status", () => {
        const config = getSubscriptionStatusConfig("cancelled");

        expect(config.label).toBe("Cancelada");
        expect(config.color).toBe("text-red-700");
        expect(config.bgColor).toBe("bg-red-100");
      });

      it("returns correct config for pending status", () => {
        const config = getSubscriptionStatusConfig("pending");

        expect(config.label).toBe("Pendiente");
        expect(config.color).toBe("text-yellow-700");
      });

      it("returns correct config for authorized status", () => {
        const config = getSubscriptionStatusConfig("authorized");

        expect(config.label).toBe("Autorizada");
        expect(config.color).toBe("text-blue-700");
      });
    });

    describe("English locale", () => {
      it("returns correct config for active status", () => {
        const config = getSubscriptionStatusConfig("active", "en");

        expect(config.label).toBe("Active");
        expect(config.color).toBe("text-green-700");
      });

      it("returns correct config for paused status", () => {
        const config = getSubscriptionStatusConfig("paused", "en");

        expect(config.label).toBe("Paused");
      });

      it("returns correct config for cancelled status", () => {
        const config = getSubscriptionStatusConfig("cancelled", "en");

        expect(config.label).toBe("Cancelled");
      });
    });

    it("returns default styling for unknown status", () => {
      const config = getSubscriptionStatusConfig("unknown_status");

      expect(config.label).toBe("unknown_status");
      expect(config.color).toBe("text-gray-700");
      expect(config.bgColor).toBe("bg-gray-100");
    });
  });

  describe("locale handling", () => {
    it("handles es-UY locale", () => {
      const config = getPaymentStatusConfig("approved", "es-UY");
      expect(config.label).toBe("Aprobado");
    });

    it("handles en-US locale", () => {
      const config = getPaymentStatusConfig("approved", "en-US");
      expect(config.label).toBe("Approved");
    });

    it("falls back to base language for unsupported regional variant", () => {
      const config = getPaymentStatusConfig("approved", "es-AR");
      expect(config.label).toBe("Aprobado");
    });
  });
});
