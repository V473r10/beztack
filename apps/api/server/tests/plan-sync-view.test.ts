import type { Product } from "@beztack/payments";
import { describe, expect, it } from "vitest";
import { buildSyncView } from "@/lib/payments/sync";

type DbPlanRow = Parameters<typeof buildSyncView>[0][number];

function localPlan(overrides: Partial<DbPlanRow> = {}): DbPlanRow {
  return {
    id: "polar_basic_month",
    provider: "polar",
    providerPlanId: "prod_basic_month",
    canonicalTierId: "basic",
    displayName: "Basic",
    description: "For growing teams",
    price: 900,
    currency: "USD",
    interval: "month",
    intervalCount: 1,
    ...overrides,
  } as DbPlanRow;
}

function remoteProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "prod_basic_month",
    name: "Basic",
    description: "For growing teams",
    type: "plan",
    price: { amount: 900, currency: "USD" },
    interval: "month",
    intervalCount: 1,
    ...overrides,
  };
}

describe("buildSyncView names", () => {
  it("treats a product named '<Tier> - <Period>' as the plan called '<Tier>'", () => {
    const [view] = buildSyncView([localPlan()], [remoteProduct({ name: "Basic - Monthly" })]);

    expect(view?.syncStatus).toBe("synced");
    expect(view?.diffs).toEqual([]);
  });

  it("still reports a product that has another name", () => {
    const [view] = buildSyncView([localPlan()], [remoteProduct({ name: "Starter - Monthly" })]);

    expect(view?.syncStatus).toBe("out-of-sync");
    expect(view?.diffs.map((diff) => diff.field)).toEqual(["displayName"]);
  });

  it("reports a different name without a period", () => {
    const [view] = buildSyncView([localPlan()], [remoteProduct({ name: "Basic Plus" })]);

    expect(view?.diffs.map((diff) => diff.field)).toEqual(["displayName"]);
  });
});
