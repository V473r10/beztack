import type { PricingTier } from "@beztack/payments";
import { describe, expect, it } from "vitest";
import { buildComparison } from "./pricing-comparison";

function tier(id: string, extra: Partial<PricingTier> = {}): PricingTier {
  return { id, name: id, description: "", price: { monthly: 0, yearly: 0 }, ...extra };
}

const label = (key: string) => key;

describe("Compare all features", () => {
  const free = tier("free", {
    features: ["basic_dashboard"],
    limits: { users: 1, storage: 1 },
    permissions: { "dashboard.read": true },
  });
  const pro = tier("pro", {
    features: ["basic_dashboard", "advanced_analytics"],
    limits: { users: 50, storage: 100 },
    permissions: { "dashboard.read": true, "analytics.read": true },
  });
  const ultimate = tier("ultimate", {
    features: ["basic_dashboard", "advanced_analytics", "audit_logs"],
    limits: { users: -1 },
    permissions: { "dashboard.read": true, "analytics.read": true },
  });

  it("has one column per catalog tier, in the order given", () => {
    const { columns } = buildComparison([free, pro, ultimate], label);

    expect(columns.map((column) => column.id)).toEqual(["free", "pro", "ultimate"]);
  });

  it("lists every feature any tier has, and marks which tiers include it", () => {
    const { groups } = buildComparison([free, pro, ultimate], label);

    const core = groups.find((group) => group.id === "core");
    expect(core?.rows.map((row) => [row.name, row.values])).toEqual([
      ["pricing.features.basic_dashboard", { free: true, pro: true, ultimate: true }],
      ["pricing.features.advanced_analytics", { free: false, pro: true, ultimate: true }],
      ["pricing.features.audit_logs", { free: false, pro: false, ultimate: true }],
    ]);
  });

  it("shows limits as numbers, unlimited for -1 and a dash where a tier has none", () => {
    const { groups } = buildComparison([free, pro, ultimate], label);

    const limits = groups.find((group) => group.id === "usageLimits");
    const users = limits?.rows.find((row) => row.name === "pricing.limits.users");
    const storage = limits?.rows.find((row) => row.name === "pricing.limits.storage");
    expect(users?.values).toEqual({
      free: { kind: "number", text: "1" },
      pro: { kind: "number", text: "50" },
      ultimate: { kind: "unlimited" },
    });
    expect(storage?.values.ultimate).toEqual({ kind: "missing" });
    expect(storage?.values.pro).toEqual({ kind: "number", text: "100GB" });
  });

  it("marks which tiers hold each permission", () => {
    const { groups } = buildComparison([free, pro, ultimate], label);

    const permissions = groups.find((group) => group.id === "permissions");
    const analytics = permissions?.rows.find(
      (row) => row.name === "pricing.permissions.analytics.read",
    );
    expect(analytics?.values).toEqual({ free: false, pro: true, ultimate: true });
  });

  it("has no groups when the catalog gave no features, limits or permissions", () => {
    expect(buildComparison([tier("free"), tier("pro")], label).groups).toEqual([]);
  });
});
