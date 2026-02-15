import { describe, expect, it } from "vitest";
import {
  createPlanSchema,
  createSubscriptionSchema,
  formatFrequency,
  formatPlanPrice,
  frequencyTypeSchema,
  getStatusColor,
  getStatusLabel,
  parseDate,
  planStatusSchema,
  subscriptionStatusSchema,
  toStringId,
} from "./types.js";

// Test constants
const REPETITIONS_YEARLY = 12;
const BILLING_DAY = 15;
const FREE_TRIAL_DAYS = 7;
const FREQUENCY_MAX_EXCEEDED = 13;
const NEGATIVE_AMOUNT = -50;
const PRICE_UYU = 1500;
const PRICE_STRING = "250.50";
const PRICE_USD = 100;
const FREQUENCY_QUARTERLY = 3;
const FREQUENCY_WEEKLY = 7;
const TEST_YEAR = 2024;
const NUMERIC_ID = 123;

describe("types", () => {
  describe("frequencyTypeSchema", () => {
    it("accepts valid frequency types", () => {
      expect(frequencyTypeSchema.parse("days")).toBe("days");
      expect(frequencyTypeSchema.parse("months")).toBe("months");
    });

    it("rejects invalid frequency types", () => {
      expect(() => frequencyTypeSchema.parse("weeks")).toThrow();
      expect(() => frequencyTypeSchema.parse("years")).toThrow();
      expect(() => frequencyTypeSchema.parse("")).toThrow();
    });
  });

  describe("planStatusSchema", () => {
    it("accepts valid plan statuses", () => {
      expect(planStatusSchema.parse("active")).toBe("active");
      expect(planStatusSchema.parse("inactive")).toBe("inactive");
    });

    it("rejects invalid plan statuses", () => {
      expect(() => planStatusSchema.parse("pending")).toThrow();
      expect(() => planStatusSchema.parse("deleted")).toThrow();
    });
  });

  describe("subscriptionStatusSchema", () => {
    it("accepts valid subscription statuses", () => {
      expect(subscriptionStatusSchema.parse("pending")).toBe("pending");
      expect(subscriptionStatusSchema.parse("authorized")).toBe("authorized");
      expect(subscriptionStatusSchema.parse("active")).toBe("active");
      expect(subscriptionStatusSchema.parse("paused")).toBe("paused");
      expect(subscriptionStatusSchema.parse("cancelled")).toBe("cancelled");
    });

    it("rejects invalid subscription statuses", () => {
      expect(() => subscriptionStatusSchema.parse("deleted")).toThrow();
      expect(() => subscriptionStatusSchema.parse("inactive")).toThrow();
    });
  });

  describe("createPlanSchema", () => {
    const validPlan = {
      reason: "Test Plan",
      auto_recurring: {
        frequency: 1,
        frequency_type: "months" as const,
        transaction_amount: 100,
        currency_id: "UYU",
      },
    };

    it("accepts valid plan data", () => {
      const result = createPlanSchema.parse(validPlan);
      expect(result.reason).toBe("Test Plan");
      expect(result.auto_recurring.frequency).toBe(1);
    });

    it("accepts plan with optional fields", () => {
      const planWithOptionals = {
        ...validPlan,
        auto_recurring: {
          ...validPlan.auto_recurring,
          repetitions: REPETITIONS_YEARLY,
          billing_day: BILLING_DAY,
          billing_day_proportional: true,
          free_trial: {
            frequency: FREE_TRIAL_DAYS,
            frequency_type: "days" as const,
          },
        },
        back_url: "https://example.com/callback",
      };
      const result = createPlanSchema.parse(planWithOptionals);
      expect(result.auto_recurring.repetitions).toBe(REPETITIONS_YEARLY);
      expect(result.auto_recurring.billing_day).toBe(BILLING_DAY);
      expect(result.back_url).toBe("https://example.com/callback");
    });

    it("rejects plan with short reason", () => {
      const invalidPlan = { ...validPlan, reason: "AB" };
      expect(() => createPlanSchema.parse(invalidPlan)).toThrow();
    });

    it("rejects plan with invalid frequency", () => {
      const invalidPlan = {
        ...validPlan,
        auto_recurring: { ...validPlan.auto_recurring, frequency: 0 },
      };
      expect(() => createPlanSchema.parse(invalidPlan)).toThrow();
    });

    it("rejects plan with frequency above max", () => {
      const invalidPlan = {
        ...validPlan,
        auto_recurring: {
          ...validPlan.auto_recurring,
          frequency: FREQUENCY_MAX_EXCEEDED,
        },
      };
      expect(() => createPlanSchema.parse(invalidPlan)).toThrow();
    });

    it("rejects plan with negative amount", () => {
      const invalidPlan = {
        ...validPlan,
        auto_recurring: {
          ...validPlan.auto_recurring,
          transaction_amount: NEGATIVE_AMOUNT,
        },
      };
      expect(() => createPlanSchema.parse(invalidPlan)).toThrow();
    });

    it("rejects plan with invalid back_url", () => {
      const invalidPlan = { ...validPlan, back_url: "not-a-url" };
      expect(() => createPlanSchema.parse(invalidPlan)).toThrow();
    });
  });

  describe("createSubscriptionSchema", () => {
    const validSubscription = {
      preapproval_plan_id: "plan_123",
      payer_email: "test@example.com",
    };

    it("accepts valid subscription data", () => {
      const result = createSubscriptionSchema.parse(validSubscription);
      expect(result.preapproval_plan_id).toBe("plan_123");
      expect(result.payer_email).toBe("test@example.com");
    });

    it("accepts subscription with optional fields", () => {
      const withOptionals = {
        ...validSubscription,
        card_token_id: "token_123",
        back_url: "https://example.com/callback",
        external_reference: "ref_123",
      };
      const result = createSubscriptionSchema.parse(withOptionals);
      expect(result.card_token_id).toBe("token_123");
      expect(result.back_url).toBe("https://example.com/callback");
    });

    it("rejects subscription with empty plan id", () => {
      const invalidSub = { ...validSubscription, preapproval_plan_id: "" };
      expect(() => createSubscriptionSchema.parse(invalidSub)).toThrow();
    });

    it("rejects subscription with invalid email", () => {
      const invalidSub = { ...validSubscription, payer_email: "invalid-email" };
      expect(() => createSubscriptionSchema.parse(invalidSub)).toThrow();
    });
  });
});

describe("utility functions", () => {
  describe("formatPlanPrice", () => {
    it("formats numeric amounts", () => {
      const result = formatPlanPrice(PRICE_UYU, "UYU");
      expect(result).toContain("1");
      expect(result).toContain("500");
    });

    it("formats string amounts", () => {
      const result = formatPlanPrice(PRICE_STRING, "UYU");
      expect(result).toContain("250");
    });

    it("handles different currencies", () => {
      const usd = formatPlanPrice(PRICE_USD, "USD");
      expect(usd).toContain("$");
    });
  });

  describe("formatFrequency", () => {
    it("formats monthly frequency singular", () => {
      expect(formatFrequency(1, "months")).toBe("cada mes");
    });

    it("formats monthly frequency plural", () => {
      expect(formatFrequency(FREQUENCY_QUARTERLY, "months")).toBe(
        "cada 3 meses"
      );
    });

    it("formats daily frequency singular", () => {
      expect(formatFrequency(1, "days")).toBe("cada día");
    });

    it("formats daily frequency plural", () => {
      expect(formatFrequency(FREQUENCY_WEEKLY, "days")).toBe("cada 7 días");
    });
  });

  describe("getStatusLabel", () => {
    it("returns correct labels for known statuses", () => {
      expect(getStatusLabel("pending")).toBe("Pendiente");
      expect(getStatusLabel("authorized")).toBe("Autorizada");
      expect(getStatusLabel("active")).toBe("Activa");
      expect(getStatusLabel("paused")).toBe("Pausada");
      expect(getStatusLabel("cancelled")).toBe("Cancelada");
      expect(getStatusLabel("inactive")).toBe("Inactivo");
    });

    it("returns status as-is for unknown statuses", () => {
      expect(getStatusLabel("unknown")).toBe("unknown");
    });
  });

  describe("getStatusColor", () => {
    it("returns correct colors for known statuses", () => {
      expect(getStatusColor("pending")).toBe("bg-yellow-500");
      expect(getStatusColor("authorized")).toBe("bg-blue-500");
      expect(getStatusColor("active")).toBe("bg-green-500");
      expect(getStatusColor("paused")).toBe("bg-orange-500");
      expect(getStatusColor("cancelled")).toBe("bg-red-500");
      expect(getStatusColor("inactive")).toBe("bg-gray-500");
    });

    it("returns default color for unknown statuses", () => {
      expect(getStatusColor("unknown")).toBe("bg-gray-500");
    });
  });

  describe("parseDate", () => {
    it("parses valid date strings", () => {
      const date = parseDate("2024-01-15T10:30:00Z");
      expect(date).toBeInstanceOf(Date);
      expect(date?.getFullYear()).toBe(TEST_YEAR);
    });

    it("returns null for null input", () => {
      expect(parseDate(null)).toBeNull();
    });

    it("returns null for undefined input", () => {
      expect(parseDate(undefined)).toBeNull();
    });

    it("returns null for invalid date strings", () => {
      expect(parseDate("not-a-date")).toBeNull();
    });
  });

  describe("toStringId", () => {
    it("converts number to string", () => {
      expect(toStringId(NUMERIC_ID)).toBe("123");
    });

    it("keeps string as string", () => {
      expect(toStringId("abc")).toBe("abc");
    });

    it("returns null for null input", () => {
      expect(toStringId(null)).toBeNull();
    });

    it("returns null for undefined input", () => {
      expect(toStringId(undefined)).toBeNull();
    });

    it("handles zero", () => {
      expect(toStringId(0)).toBe("0");
    });
  });
});
