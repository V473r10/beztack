import { describe, expect, it, vi } from "vitest";
import {
  type AdminTierOverrideRecord,
  type AdminTierOverrideStore,
  applyAdminTierOverride,
  type OverrideAuditEntry,
  type OverrideCatalogPlan,
} from "./admin-tier-override";

vi.mock("@beztack/db", () => ({
  adminTierOverride: {},
  adminTierOverrideAudit: {},
  db: {},
  member: {},
  plan: {},
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn(),
  eq: vi.fn(),
}));

type StoredOverrideInput = Parameters<
  AdminTierOverrideStore["saveOverride"]
>[0];

function catalogPlan(
  overrides: Partial<OverrideCatalogPlan> = {}
): OverrideCatalogPlan {
  return {
    id: "polar_pro_month",
    provider: "polar",
    providerPlanId: "prod_pro_month",
    canonicalTierId: "pro",
    price: 2900,
    interval: "month",
    intervalCount: 1,
    visible: true,
    status: "active",
    ...overrides,
  };
}

function createStore(options?: {
  plans?: OverrideCatalogPlan[];
  existingOverrides?: AdminTierOverrideRecord[];
  organizationMemberships?: string[];
}) {
  const overrides = new Map<string, AdminTierOverrideRecord>();
  const audits: OverrideAuditEntry[] = [];
  const organizationMemberships = new Set(
    options?.organizationMemberships ?? []
  );

  for (const override of options?.existingOverrides ?? []) {
    overrides.set(`${override.targetType}:${override.targetId}`, override);
  }

  const store: AdminTierOverrideStore = {
    listActiveVisibleCatalogPlans(provider) {
      return Promise.resolve(
        (options?.plans ?? [catalogPlan()]).filter(
          (plan) =>
            plan.provider === provider &&
            plan.visible &&
            plan.status === "active"
        )
      );
    },
    findOverride(target) {
      return Promise.resolve(
        overrides.get(`${target.type}:${target.id}`) ?? null
      );
    },
    saveOverride(input: StoredOverrideInput) {
      const existing = overrides.get(`${input.target.type}:${input.target.id}`);
      const record: AdminTierOverrideRecord = {
        id: existing?.id ?? overrides.size + 1,
        targetType: input.target.type,
        targetId: input.target.id,
        tier: input.tier,
        billingCadence: input.billingCadence,
        actorUserId: input.actorUserId,
        sourceAction: input.sourceAction,
        createdAt: existing?.createdAt ?? input.now,
        updatedAt: input.now,
      };
      overrides.set(`${record.targetType}:${record.targetId}`, record);
      return Promise.resolve(record);
    },
    deleteOverride() {
      return Promise.resolve(null);
    },
    createAuditEntry(entry) {
      audits.push({ id: audits.length + 1, ...entry });
      return Promise.resolve();
    },
    isOrganizationMember(userId, organizationId) {
      return Promise.resolve(
        organizationMemberships.has(`${userId}:${organizationId}`)
      );
    },
  };

  return { audits, overrides, store };
}

const NOW = new Date("2026-06-01T00:00:00.000Z");

describe("applyAdminTierOverride", () => {
  it("stores a paid Admin tier override from an active visible Pricing catalog plan", async () => {
    const { audits, overrides, store } = createStore();

    const result = await applyAdminTierOverride({
      actor: {
        email: "admin@example.com",
        id: "admin_1",
        role: "sudo",
      },
      appAdminEmails: ["admin@example.com"],
      billingPeriod: "monthly",
      productId: "prod_pro_month",
      provider: "polar",
      sourceAction: "checkout",
      store,
      subscriptionMode: "user",
      userId: "user_1",
      now: () => NOW,
    });

    expect(result).toMatchObject({
      changed: true,
      override: {
        targetType: "user",
        targetId: "user_1",
        tier: "pro",
        billingCadence: "monthly",
      },
    });
    expect(overrides.get("user:user_1")).toMatchObject({
      tier: "pro",
      billingCadence: "monthly",
      actorUserId: "admin_1",
      sourceAction: "checkout",
    });
    expect(audits).toMatchObject([
      {
        action: "apply",
        actorUserId: "admin_1",
        targetType: "user",
        targetId: "user_1",
        tier: "pro",
        billingCadence: "monthly",
        createdAt: NOW,
      },
    ]);
  });

  it("stores no Billing cadence for an explicit Free override", async () => {
    const { store } = createStore({
      plans: [
        catalogPlan({
          id: "polar_free_month",
          canonicalTierId: "free",
          price: 0,
        }),
      ],
    });

    const result = await applyAdminTierOverride({
      actor: {
        email: "admin@example.com",
        id: "admin_1",
        role: "sudo",
      },
      appAdminEmails: ["admin@example.com"],
      billingPeriod: "monthly",
      planId: "free",
      provider: "polar",
      sourceAction: "checkout",
      store,
      subscriptionMode: "user",
      userId: "user_1",
      now: () => NOW,
    });

    expect(result.override).toMatchObject({
      tier: "free",
      billingCadence: null,
    });
  });

  it("keeps Billing cadence for a zero-priced paid catalog plan", async () => {
    const { store } = createStore({
      plans: [catalogPlan({ price: 0 })],
    });

    const result = await applyAdminTierOverride({
      actor: {
        email: "admin@example.com",
        id: "admin_1",
        role: "sudo",
      },
      appAdminEmails: ["admin@example.com"],
      billingPeriod: "monthly",
      productId: "prod_pro_month",
      provider: "polar",
      sourceAction: "checkout",
      store,
      subscriptionMode: "user",
      userId: "user_1",
      now: () => NOW,
    });

    expect(result.override).toMatchObject({
      tier: "pro",
      billingCadence: "monthly",
    });
  });

  it("treats applying the same override as a no-op without audit noise", async () => {
    const { audits, store } = createStore({
      existingOverrides: [
        {
          id: 1,
          targetType: "user",
          targetId: "user_1",
          tier: "pro",
          billingCadence: "monthly",
          actorUserId: "admin_1",
          sourceAction: "checkout",
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    });

    const result = await applyAdminTierOverride({
      actor: {
        email: "admin@example.com",
        id: "admin_1",
        role: "sudo",
      },
      appAdminEmails: ["admin@example.com"],
      billingPeriod: "monthly",
      productId: "prod_pro_month",
      provider: "polar",
      sourceAction: "checkout",
      store,
      subscriptionMode: "user",
      userId: "user_1",
      now: () => NOW,
    });

    expect(result.changed).toBe(false);
    expect(audits).toHaveLength(0);
  });
});
