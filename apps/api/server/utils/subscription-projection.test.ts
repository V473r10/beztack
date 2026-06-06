import { describe, expect, it, vi } from "vitest";
import type {
  PendingPlanChangeRecord,
  PlanChangeCatalogPlan,
  PlanChangeProjectionStore,
} from "./plan-change";
import {
  type ProjectionPayment,
  type ProjectionSubscription,
  projectSubscriptionProviderEvent,
  type SubscriptionProjectionEventEnvelope,
  type SubscriptionProjectionProviderAdapter,
  type SubscriptionProjectionStore,
} from "./subscription-projection";

type StoredSubscription = Parameters<
  SubscriptionProjectionStore["upsertSubscription"]
>[0];

type StoredPayment = Parameters<
  SubscriptionProjectionStore["upsertPayment"]
>[0];

const FIRST_WEBHOOK_LOG_ID = 1;
const PRORATED_UPGRADE_AMOUNT = 250;
const FULL_UPGRADE_AMOUNT = 1000;
const PLAN_CHANGE_EFFECTIVE_AT = new Date("2026-06-01T00:00:00.000Z");

function catalogPlan(
  overrides: Partial<PlanChangeCatalogPlan> = {}
): PlanChangeCatalogPlan {
  return {
    id: "mercadopago_basic_month",
    paymentProvider: "mercadopago",
    providerPlanId: "provider_basic_month",
    canonicalTierId: "basic",
    tierRank: 1,
    billingCadence: "monthly",
    price: { amount: 2900, currency: "UYU" },
    ...overrides,
  };
}

function pendingPlanChange(
  overrides: Partial<PendingPlanChangeRecord> = {}
): PendingPlanChangeRecord {
  return {
    id: "pending_sub_1",
    direction: "downgrade",
    effectiveAt: PLAN_CHANGE_EFFECTIVE_AT,
    membershipTarget: { type: "user", id: "user_1" },
    providerConfirmedPlanChangeId: "provider_pending_change_1",
    subscriptionId: "sub_1",
    targetPlanSnapshot: catalogPlan(),
    ...overrides,
  };
}

function createStore(options?: {
  users?: string[];
  organizations?: string[];
  emailToUserId?: Record<string, string>;
  failSavePendingPlanChange?: boolean;
  pendingPlanChanges?: PendingPlanChangeRecord[];
  plans?: PlanChangeCatalogPlan[];
}): SubscriptionProjectionStore &
  PlanChangeProjectionStore & {
    subscriptions: Map<string, StoredSubscription>;
    payments: Map<string, StoredPayment>;
    userMemberships: Map<string, Record<string, unknown>>;
    organizationMemberships: Map<string, Record<string, unknown>>;
    webhookLogs: Map<string, { id: number; status: string | null }>;
    pendingPlanChanges: Map<string, PendingPlanChangeRecord>;
    planChangeMembershipMoves: Parameters<
      PlanChangeProjectionStore["moveMembershipToPlan"]
    >[0][];
  } {
  let nextLogId = FIRST_WEBHOOK_LOG_ID;
  const users = new Set(options?.users ?? []);
  const organizations = new Set(options?.organizations ?? []);
  const emailToUserId = options?.emailToUserId ?? {};
  const subscriptions = new Map<string, StoredSubscription>();
  const payments = new Map<string, StoredPayment>();
  const userMemberships = new Map<string, Record<string, unknown>>();
  const organizationMemberships = new Map<string, Record<string, unknown>>();
  const webhookLogs = new Map<string, { id: number; status: string | null }>();
  const pendingPlanChanges = new Map<string, PendingPlanChangeRecord>();
  const planChangeMembershipMoves: Parameters<
    PlanChangeProjectionStore["moveMembershipToPlan"]
  >[0][] = [];
  for (const existingPendingPlanChange of options?.pendingPlanChanges ?? []) {
    pendingPlanChanges.set(
      existingPendingPlanChange.subscriptionId,
      existingPendingPlanChange
    );
  }

  return {
    subscriptions,
    payments,
    userMemberships,
    organizationMemberships,
    webhookLogs,
    pendingPlanChanges,
    planChangeMembershipMoves,
    cancelPendingPlanChange(subscriptionId) {
      const canceledPendingPlanChange =
        pendingPlanChanges.get(subscriptionId) ?? null;
      pendingPlanChanges.delete(subscriptionId);
      return Promise.resolve(canceledPendingPlanChange);
    },
    clearPendingPlanChange(subscriptionId) {
      const clearedPendingPlanChange =
        pendingPlanChanges.get(subscriptionId) ?? null;
      pendingPlanChanges.delete(subscriptionId);
      return Promise.resolve(clearedPendingPlanChange);
    },
    findPendingPlanChange(subscriptionId) {
      return Promise.resolve(pendingPlanChanges.get(subscriptionId) ?? null);
    },
    listActiveVisiblePricingCatalogPlans(paymentProvider) {
      return Promise.resolve(
        (options?.plans ?? [catalogPlan()]).filter(
          (plan) => plan.paymentProvider === paymentProvider
        )
      );
    },
    findWebhookLogByEventKey(eventKey) {
      const log = webhookLogs.get(eventKey);
      return Promise.resolve(log ? { eventKey, ...log } : null);
    },
    createWebhookLog(input) {
      const log = { id: nextLogId, status: "received" };
      nextLogId += 1;
      webhookLogs.set(input.eventKey, log);
      return Promise.resolve({ eventKey: input.eventKey, ...log });
    },
    markWebhookLogReceived(id) {
      for (const log of webhookLogs.values()) {
        if (log.id === id) {
          log.status = "received";
        }
      }
      return Promise.resolve();
    },
    markWebhookLogProcessed(id) {
      for (const log of webhookLogs.values()) {
        if (log.id === id) {
          log.status = "processed";
        }
      }
      return Promise.resolve();
    },
    markWebhookLogFailed(id) {
      for (const log of webhookLogs.values()) {
        if (log.id === id) {
          log.status = "failed";
        }
      }
      return Promise.resolve();
    },
    upsertSubscription(input) {
      subscriptions.set(input.id, input);
      return Promise.resolve();
    },
    upsertPayment(input) {
      payments.set(input.id, input);
      return Promise.resolve();
    },
    findUserIdByEmail(email) {
      return Promise.resolve(emailToUserId[email] ?? null);
    },
    userExists(userId) {
      return Promise.resolve(users.has(userId));
    },
    organizationExists(organizationId) {
      return Promise.resolve(organizations.has(organizationId));
    },
    updateUserMembership(userId, updates) {
      userMemberships.set(userId, updates);
      return Promise.resolve();
    },
    updateOrganizationMembership(organizationId, updates) {
      organizationMemberships.set(organizationId, updates);
      return Promise.resolve();
    },
    moveMembershipToPlan(input) {
      planChangeMembershipMoves.push(input);
      const updates = {
        subscriptionTier: input.targetPlan.canonicalTierId,
        subscriptionStatus: "active",
        subscriptionId: input.subscriptionId,
      };

      if (input.membershipTarget.type === "organization") {
        organizationMemberships.set(input.membershipTarget.id, {
          ...(organizationMemberships.get(input.membershipTarget.id) ?? {}),
          ...updates,
        });
        return Promise.resolve();
      }

      userMemberships.set(input.membershipTarget.id, {
        ...(userMemberships.get(input.membershipTarget.id) ?? {}),
        ...updates,
      });
      return Promise.resolve();
    },
    savePendingPlanChange(input) {
      if (options?.failSavePendingPlanChange) {
        throw new Error("database unavailable");
      }

      const savedPendingPlanChange = {
        id: `pending_${input.subscriptionId}`,
        ...input,
      };
      pendingPlanChanges.set(input.subscriptionId, savedPendingPlanChange);
      return Promise.resolve(savedPendingPlanChange);
    },
  };
}

function createProvider(options: {
  subscriptions?: Record<string, ProjectionSubscription>;
  payments?: Record<string, ProjectionPayment>;
}): SubscriptionProjectionProviderAdapter {
  return {
    provider: "mercadopago",
    getSubscription: vi.fn((id) =>
      Promise.resolve(options.subscriptions?.[id] ?? null)
    ),
    getPayment: vi.fn((id) => Promise.resolve(options.payments?.[id] ?? null)),
    adjustSubscriptionAmount: vi.fn(() => Promise.resolve()),
    cancelSubscription: vi.fn(() => Promise.resolve()),
  };
}

function subscriptionEnvelope(
  overrides: Partial<SubscriptionProjectionEventEnvelope> = {}
): SubscriptionProjectionEventEnvelope {
  return {
    provider: "mercadopago",
    eventId: "evt_sub_1",
    eventType: "subscription_preapproval.updated",
    action: "updated",
    resourceType: "subscription",
    resourceId: "sub_1",
    rawPayload: { id: "evt_sub_1", type: "subscription_preapproval" },
    ...overrides,
  };
}

function paymentEnvelope(
  overrides: Partial<SubscriptionProjectionEventEnvelope> = {}
): SubscriptionProjectionEventEnvelope {
  return {
    provider: "mercadopago",
    eventId: "evt_pay_1",
    eventType: "payment.updated",
    action: "updated",
    resourceType: "payment",
    resourceId: "pay_1",
    rawPayload: { id: "evt_pay_1", type: "payment" },
    ...overrides,
  };
}

describe("projectSubscriptionProviderEvent", () => {
  it("projects provider Subscription state to the User Membership target", async () => {
    const store = createStore({ users: ["user_1"] });
    const provider = createProvider({
      subscriptions: {
        sub_1: {
          id: "sub_1",
          rawStatus: "authorized",
          productId: "plan_pro",
          productName: "Pro",
          customerEmail: "user@example.com",
          currentPeriodEnd: new Date("2026-06-01T00:00:00.000Z"),
          metadata: {
            userId: "user_1",
            tier: "pro",
          },
        },
      },
    });

    const outcome = await projectSubscriptionProviderEvent(
      subscriptionEnvelope(),
      {
        store,
        provider,
        subscriptionMode: "user",
      }
    );

    expect(outcome.status).toBe("processed");
    expect(store.subscriptions.get("sub_1")).toMatchObject({
      id: "sub_1",
      provider: "mercadopago",
      providerSubscriptionId: "sub_1",
      userId: "user_1",
      organizationId: null,
      status: "authorized",
    });
    expect(store.userMemberships.get("user_1")).toMatchObject({
      subscriptionId: "sub_1",
      subscriptionStatus: "active",
      subscriptionTier: "pro",
      subscriptionValidUntil: new Date("2026-06-01T00:00:00.000Z"),
    });
  });

  it("handles approved prorated upgrade payments once", async () => {
    const store = createStore({ users: ["user_1"] });
    const provider = createProvider({
      subscriptions: {
        sub_new: {
          id: "sub_new",
          rawStatus: "authorized",
          productId: "plan_ultimate",
          productName: "Ultimate",
          customerEmail: "user@example.com",
          currentPeriodEnd: new Date("2026-06-01T00:00:00.000Z"),
          metadata: {
            userId: "user_1",
            tier: "ultimate",
          },
        },
      },
      payments: {
        pay_1: {
          id: "pay_1",
          status: "approved",
          amount: PRORATED_UPGRADE_AMOUNT,
          currency: "UYU",
          payerEmail: "user@example.com",
          subscriptionId: "sub_new",
          metadata: {
            userId: "user_1",
            tier: "ultimate",
            fullAmount: FULL_UPGRADE_AMOUNT,
            previousSubscriptionId: "sub_old",
          },
        },
      },
    });

    const outcome = await projectSubscriptionProviderEvent(paymentEnvelope(), {
      store,
      provider,
      subscriptionMode: "user",
    });

    expect(outcome.status).toBe("processed");
    expect(provider.adjustSubscriptionAmount).toHaveBeenCalledWith(
      "sub_new",
      FULL_UPGRADE_AMOUNT
    );
    expect(provider.cancelSubscription).toHaveBeenCalledWith("sub_old", true);
    expect(store.payments.get("pay_1")).toMatchObject({
      id: "pay_1",
      status: "approved",
      subscriptionId: "sub_new",
    });
    expect(store.userMemberships.get("user_1")).toMatchObject({
      subscriptionId: "sub_new",
      subscriptionStatus: "active",
      subscriptionTier: "ultimate",
    });
  });

  it("does not use provider downgrade metadata as Membership source of truth", async () => {
    const store = createStore({ users: ["user_1"] });
    const provider = createProvider({
      subscriptions: {
        sub_1: {
          id: "sub_1",
          rawStatus: "authorized",
          productId: "plan_basic",
          productName: "Basic",
          customerEmail: "user@example.com",
          currentPeriodEnd: new Date("2026-06-01T00:00:00.000Z"),
          metadata: {
            userId: "user_1",
            tier: "basic",
            proratedDowngrade: true,
            previousTier: "pro",
            previousSubscriptionId: "sub_pro",
          },
        },
      },
    });

    const outcome = await projectSubscriptionProviderEvent(
      subscriptionEnvelope({
        eventId: "evt_down_metadata",
        resourceId: "sub_1",
      }),
      {
        store,
        provider,
        subscriptionMode: "user",
      }
    );

    expect(outcome.status).toBe("processed");
    expect(store.userMemberships.get("user_1")).toMatchObject({
      subscriptionId: "sub_1",
      subscriptionStatus: "active",
      subscriptionTier: "basic",
    });
    expect(provider.cancelSubscription).not.toHaveBeenCalled();
  });

  it("returns duplicate without repeating provider follow-up writes", async () => {
    const store = createStore({ users: ["user_1"] });
    const provider = createProvider({
      subscriptions: {
        sub_new: {
          id: "sub_new",
          rawStatus: "authorized",
          productId: "plan_ultimate",
          productName: "Ultimate",
          customerEmail: "user@example.com",
          metadata: {
            userId: "user_1",
            tier: "ultimate",
          },
        },
      },
      payments: {
        pay_1: {
          id: "pay_1",
          status: "approved",
          amount: PRORATED_UPGRADE_AMOUNT,
          currency: "UYU",
          payerEmail: "user@example.com",
          subscriptionId: "sub_new",
          metadata: {
            userId: "user_1",
            tier: "ultimate",
            fullAmount: FULL_UPGRADE_AMOUNT,
            previousSubscriptionId: "sub_old",
          },
        },
      },
    });

    const first = await projectSubscriptionProviderEvent(paymentEnvelope(), {
      store,
      provider,
      subscriptionMode: "user",
    });
    const second = await projectSubscriptionProviderEvent(paymentEnvelope(), {
      store,
      provider,
      subscriptionMode: "user",
    });

    expect(first.status).toBe("processed");
    expect(second.status).toBe("duplicate");
    expect(provider.adjustSubscriptionAmount).toHaveBeenCalledTimes(1);
    expect(provider.cancelSubscription).toHaveBeenCalledTimes(1);
  });

  it("persists Subscription evidence and warns when the Membership target is missing", async () => {
    const store = createStore();
    const provider = createProvider({
      subscriptions: {
        sub_1: {
          id: "sub_1",
          rawStatus: "authorized",
          productId: "plan_pro",
          productName: "Pro",
          customerEmail: "missing@example.com",
          metadata: {
            userId: "missing_user",
            tier: "pro",
          },
        },
      },
    });

    const outcome = await projectSubscriptionProviderEvent(
      subscriptionEnvelope(),
      {
        store,
        provider,
        subscriptionMode: "user",
      }
    );

    expect(outcome.status).toBe("processed");
    expect(outcome.warnings).toContain(
      "Membership target could not be resolved for Subscription sub_1"
    );
    expect(store.subscriptions.get("sub_1")).toMatchObject({
      id: "sub_1",
      userId: null,
      organizationId: null,
      status: "authorized",
    });
    expect(store.userMemberships.size).toBe(0);
  });

  it("uses current provider state for out-of-order events", async () => {
    const store = createStore({ organizations: ["org_1"] });
    const provider = createProvider({
      subscriptions: {
        sub_1: {
          id: "sub_1",
          rawStatus: "authorized",
          productId: "plan_ultimate",
          productName: "Ultimate",
          customerEmail: "owner@example.com",
          currentPeriodEnd: new Date("2026-06-01T00:00:00.000Z"),
          metadata: {
            organizationId: "org_1",
            tier: "ultimate",
          },
        },
      },
    });

    const outcome = await projectSubscriptionProviderEvent(
      subscriptionEnvelope({
        eventId: "evt_old_created",
        action: "created",
        eventType: "subscription_preapproval.created",
        rawPayload: { id: "evt_old_created", action: "created" },
      }),
      {
        store,
        provider,
        subscriptionMode: "organization",
      }
    );

    expect(outcome.status).toBe("processed");
    expect(store.organizationMemberships.get("org_1")).toMatchObject({
      subscriptionId: "sub_1",
      subscriptionStatus: "active",
      subscriptionTier: "ultimate",
    });
  });

  it("skips Subscription webhooks when the provider boundary hides the Subscription", async () => {
    const store = createStore({ users: ["user_1"] });
    const provider = createProvider({ subscriptions: {} });

    const outcome = await projectSubscriptionProviderEvent(
      subscriptionEnvelope({ resourceId: "sub_cross_app" }),
      {
        store,
        provider,
        subscriptionMode: "user",
      }
    );

    expect(outcome.status).toBe("skipped");
    expect(outcome.warnings).toContain(
      "Provider Subscription sub_cross_app was not found"
    );
    expect(store.subscriptions.size).toBe(0);
    expect(store.userMemberships.size).toBe(0);
  });

  it("does not apply approved payment follow-ups when the related Subscription cannot be verified", async () => {
    const store = createStore({ users: ["user_1"] });
    const provider = createProvider({
      subscriptions: {},
      payments: {
        pay_1: {
          id: "pay_1",
          status: "approved",
          amount: PRORATED_UPGRADE_AMOUNT,
          currency: "UYU",
          payerEmail: "user@example.com",
          subscriptionId: "sub_cross_app",
          metadata: {
            userId: "user_1",
            tier: "ultimate",
            fullAmount: FULL_UPGRADE_AMOUNT,
            previousSubscriptionId: "sub_old",
          },
        },
      },
    });

    const outcome = await projectSubscriptionProviderEvent(paymentEnvelope(), {
      store,
      provider,
      subscriptionMode: "user",
    });

    expect(outcome.status).toBe("processed");
    expect(provider.adjustSubscriptionAmount).not.toHaveBeenCalled();
    expect(provider.cancelSubscription).not.toHaveBeenCalled();
    expect(store.subscriptions.size).toBe(0);
    expect(store.userMemberships.size).toBe(0);
    expect(store.payments.get("pay_1")).toMatchObject({
      id: "pay_1",
      subscriptionId: null,
    });
  });

  it("reconciles provider-confirmed Plan change evidence into missing Pending state", async () => {
    const targetPlan = catalogPlan({
      id: "mercadopago_basic_year",
      providerPlanId: "provider_basic_year",
      billingCadence: "yearly",
      price: { amount: 29_000, currency: "UYU" },
    });
    const store = createStore({
      users: ["user_1"],
      plans: [targetPlan],
    });
    const provider = createProvider({
      subscriptions: {
        sub_1: {
          id: "sub_1",
          rawStatus: "authorized",
          productId: "provider_pro_month",
          productName: "Pro",
          customerEmail: "user@example.com",
          currentPeriodEnd: new Date("2026-07-01T00:00:00.000Z"),
          metadata: {
            userId: "user_1",
            tier: "pro",
            direction: "downgrade",
            targetPlanId: "provider_basic_year",
            providerConfirmedPlanChangeId: "provider_basic_year",
          },
        },
      },
    });

    const outcome = await projectSubscriptionProviderEvent(
      subscriptionEnvelope(),
      {
        store,
        provider,
        subscriptionMode: "user",
        planChangeStore: store,
        now: () => PLAN_CHANGE_EFFECTIVE_AT,
      }
    );

    expect(outcome.status).toBe("processed");
    expect(outcome.touched.pendingPlanChangeId).toBe("pending_sub_1");
    expect(store.pendingPlanChanges.get("sub_1")).toMatchObject({
      providerConfirmedPlanChangeId: "provider_basic_year",
      targetPlanSnapshot: targetPlan,
    });
    expect(store.userMemberships.get("user_1")).toMatchObject({
      subscriptionTier: "pro",
    });
  });

  it("surfaces a reconciling Plan change warning when missing Pending state cannot be stored", async () => {
    const store = createStore({
      users: ["user_1"],
      failSavePendingPlanChange: true,
      plans: [catalogPlan({ providerPlanId: "provider_basic_year" })],
    });
    const provider = createProvider({
      subscriptions: {
        sub_1: {
          id: "sub_1",
          rawStatus: "authorized",
          productId: "provider_pro_month",
          productName: "Pro",
          customerEmail: "user@example.com",
          currentPeriodEnd: new Date("2026-07-01T00:00:00.000Z"),
          metadata: {
            userId: "user_1",
            tier: "pro",
            direction: "downgrade",
            targetPlanId: "provider_basic_year",
            providerConfirmedPlanChangeId: "provider_basic_year",
          },
        },
      },
    });

    const outcome = await projectSubscriptionProviderEvent(
      subscriptionEnvelope({ eventId: "evt_sub_reconciling" }),
      {
        store,
        provider,
        subscriptionMode: "user",
        planChangeStore: store,
        now: () => PLAN_CHANGE_EFFECTIVE_AT,
      }
    );

    expect(outcome.status).toBe("processed");
    expect(outcome.warnings).toContain(
      "Plan change provider_basic_year is still reconciling: database unavailable"
    );
    expect(store.pendingPlanChanges).toEqual(new Map());
  });

  it("activates a Pending Plan change at renewal through the Plan change Module", async () => {
    const acceptedTargetSnapshot = catalogPlan({
      id: "mercadopago_basic_year",
      providerPlanId: "provider_basic_year",
      billingCadence: "yearly",
      price: { amount: 29_000, currency: "UYU" },
    });
    const store = createStore({
      users: ["user_1"],
      pendingPlanChanges: [
        pendingPlanChange({ targetPlanSnapshot: acceptedTargetSnapshot }),
      ],
    });
    const provider = createProvider({
      subscriptions: {
        sub_1: {
          id: "sub_1",
          rawStatus: "authorized",
          productId: "provider_pro_month",
          productName: "Pro",
          customerEmail: "user@example.com",
          currentPeriodEnd: new Date("2026-07-01T00:00:00.000Z"),
          metadata: {
            userId: "user_1",
            tier: "pro",
          },
        },
      },
    });

    const outcome = await projectSubscriptionProviderEvent(
      subscriptionEnvelope(),
      {
        store,
        provider,
        subscriptionMode: "user",
        planChangeStore: store,
        now: () => PLAN_CHANGE_EFFECTIVE_AT,
      }
    );

    expect(outcome.status).toBe("processed");
    expect(outcome.touched.pendingPlanChangeId).toBe("pending_sub_1");
    expect(store.userMemberships.get("user_1")).toMatchObject({
      subscriptionId: "sub_1",
      subscriptionStatus: "active",
      subscriptionTier: "basic",
    });
    expect(store.planChangeMembershipMoves).toEqual([
      {
        membershipTarget: { type: "user", id: "user_1" },
        paymentId: "renewal:sub_1",
        subscriptionId: "sub_1",
        targetPlan: acceptedTargetSnapshot,
      },
    ]);
    expect(store.pendingPlanChanges).toEqual(new Map());
  });

  it("cancels a Pending Plan change when the Current Subscription is canceled", async () => {
    const store = createStore({
      users: ["user_1"],
      pendingPlanChanges: [pendingPlanChange()],
    });
    const provider = createProvider({
      subscriptions: {
        sub_1: {
          id: "sub_1",
          rawStatus: "canceled",
          productId: "provider_pro_month",
          productName: "Pro",
          customerEmail: "user@example.com",
          currentPeriodEnd: new Date("2026-07-01T00:00:00.000Z"),
          metadata: {
            userId: "user_1",
            tier: "pro",
          },
        },
      },
    });

    const outcome = await projectSubscriptionProviderEvent(
      subscriptionEnvelope(),
      {
        store,
        provider,
        subscriptionMode: "user",
        planChangeStore: store,
        now: () => PLAN_CHANGE_EFFECTIVE_AT,
      }
    );

    expect(outcome.status).toBe("processed");
    expect(outcome.touched.pendingPlanChangeId).toBe("pending_sub_1");
    expect(store.planChangeMembershipMoves).toEqual([]);
    expect(store.pendingPlanChanges).toEqual(new Map());
    expect(store.userMemberships.get("user_1")).toMatchObject({
      subscriptionId: "sub_1",
      subscriptionStatus: "canceled",
      subscriptionTier: "pro",
    });
  });

  it("cancels a Pending Plan change when renewal evidence is failed", async () => {
    const store = createStore({
      users: ["user_1"],
      pendingPlanChanges: [pendingPlanChange()],
    });
    const provider = createProvider({
      subscriptions: {
        sub_1: {
          id: "sub_1",
          rawStatus: "past_due",
          productId: "provider_pro_month",
          productName: "Pro",
          customerEmail: "user@example.com",
          currentPeriodEnd: new Date("2026-07-01T00:00:00.000Z"),
          metadata: {
            userId: "user_1",
            tier: "pro",
          },
        },
      },
    });

    const outcome = await projectSubscriptionProviderEvent(
      subscriptionEnvelope({ eventId: "evt_sub_failed" }),
      {
        store,
        provider,
        subscriptionMode: "user",
        planChangeStore: store,
        now: () => PLAN_CHANGE_EFFECTIVE_AT,
      }
    );

    expect(outcome.status).toBe("processed");
    expect(outcome.touched.pendingPlanChangeId).toBe("pending_sub_1");
    expect(store.planChangeMembershipMoves).toEqual([]);
    expect(store.pendingPlanChanges).toEqual(new Map());
    expect(store.userMemberships.get("user_1")).toMatchObject({
      subscriptionId: "sub_1",
      subscriptionStatus: "past_due",
      subscriptionTier: "pro",
    });
  });

  it("keeps failed events retryable", async () => {
    const store = createStore({ users: ["user_1"] });
    const provider = createProvider({ subscriptions: {} });
    vi.mocked(provider.getSubscription)
      .mockRejectedValueOnce(new Error("provider unavailable"))
      .mockResolvedValueOnce({
        id: "sub_1",
        rawStatus: "authorized",
        productId: "plan_pro",
        customerEmail: "user@example.com",
        metadata: {
          userId: "user_1",
          tier: "pro",
        },
      });

    const first = await projectSubscriptionProviderEvent(
      subscriptionEnvelope(),
      {
        store,
        provider,
        subscriptionMode: "user",
      }
    );
    const second = await projectSubscriptionProviderEvent(
      subscriptionEnvelope(),
      {
        store,
        provider,
        subscriptionMode: "user",
      }
    );

    expect(first.status).toBe("failed");
    expect(second.status).toBe("processed");
    expect(provider.getSubscription).toHaveBeenCalledTimes(2);
    expect(store.userMemberships.get("user_1")).toMatchObject({
      subscriptionId: "sub_1",
      subscriptionStatus: "active",
      subscriptionTier: "pro",
    });
  });
});
