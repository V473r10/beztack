import { describe, expect, it } from "vitest";
import { plansKeys } from "./use-plans.js";
import { subscriptionsKeys } from "./use-subscriptions.js";

describe("react/hooks", () => {
  describe("plansKeys", () => {
    it("generates all key", () => {
      expect(plansKeys.all).toEqual(["mp-plans"]);
    });

    it("generates list key without status", () => {
      expect(plansKeys.list()).toEqual(["mp-plans", undefined]);
    });

    it("generates list key with status", () => {
      expect(plansKeys.list("active")).toEqual(["mp-plans", "active"]);
    });

    it("generates detail key", () => {
      expect(plansKeys.detail("plan_123")).toEqual([
        "mp-plans",
        "detail",
        "plan_123",
      ]);
    });
  });

  describe("subscriptionsKeys", () => {
    it("generates all key", () => {
      expect(subscriptionsKeys.all).toEqual(["mp-subscriptions"]);
    });

    it("generates lists key", () => {
      expect(subscriptionsKeys.lists()).toEqual(["mp-subscriptions", "list"]);
    });

    it("generates list key with filters", () => {
      const filters = { status: "active", limit: 10 };
      expect(subscriptionsKeys.list(filters)).toEqual([
        "mp-subscriptions",
        "list",
        filters,
      ]);
    });

    it("generates details key", () => {
      expect(subscriptionsKeys.details()).toEqual([
        "mp-subscriptions",
        "detail",
      ]);
    });

    it("generates detail key for specific id", () => {
      expect(subscriptionsKeys.detail("sub_123")).toEqual([
        "mp-subscriptions",
        "detail",
        "sub_123",
      ]);
    });

    it("generates invoices key for subscription", () => {
      expect(subscriptionsKeys.invoices("sub_123")).toEqual([
        "mp-subscriptions",
        "detail",
        "sub_123",
        "invoices",
      ]);
    });
  });

  describe("query key hierarchy", () => {
    it("maintains proper key hierarchy for plans", () => {
      const allKey = plansKeys.all;
      const listKey = plansKeys.list("active");
      const detailKey = plansKeys.detail("plan_123");

      // List key should start with all key
      expect(listKey[0]).toBe(allKey[0]);

      // Detail key should start with all key
      expect(detailKey[0]).toBe(allKey[0]);
    });

    it("maintains proper key hierarchy for subscriptions", () => {
      const allKey = subscriptionsKeys.all;
      const listsKey = subscriptionsKeys.lists();
      const detailsKey = subscriptionsKeys.details();
      const detailKey = subscriptionsKeys.detail("sub_123");
      const invoicesKey = subscriptionsKeys.invoices("sub_123");

      // All keys should start with base key
      expect(listsKey[0]).toBe(allKey[0]);
      expect(detailsKey[0]).toBe(allKey[0]);
      expect(detailKey[0]).toBe(allKey[0]);
      expect(invoicesKey[0]).toBe(allKey[0]);

      // Invoices key should contain detail id
      expect(invoicesKey).toContain("sub_123");
    });

    it("generates unique keys for different subscriptions", () => {
      const detail1 = subscriptionsKeys.detail("sub_1");
      const detail2 = subscriptionsKeys.detail("sub_2");

      expect(detail1).not.toEqual(detail2);
      expect(detail1[2]).toBe("sub_1");
      expect(detail2[2]).toBe("sub_2");
    });

    it("generates unique keys for different filters", () => {
      const list1 = subscriptionsKeys.list({ status: "active" });
      const list2 = subscriptionsKeys.list({ status: "paused" });

      expect(list1).not.toEqual(list2);
    });
  });
});
