import { describe, expect, it, vi } from "vitest";
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
const DOWNGRADE_AMOUNT = 500;

function createStore(options?: {
  users?: string[];
  organizations?: string[];
  emailToUserId?: Record<string, string>;
}): SubscriptionProjectionStore & {
  subscriptions: Map<string, StoredSubscription>;
  payments: Map<string, StoredPayment>;
  userMemberships: Map<string, Record<string, unknown>>;
  organizationMemberships: Map<string, Record<string, unknown>>;
  webhookLogs: Map<string, { id: number; status: string | null }>;
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

  return {
    subscriptions,
    payments,
    userMemberships,
    organizationMemberships,
    webhookLogs,
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

  it("preserves the previous tier during a prorated downgrade trial", async () => {
    const store = createStore({ users: ["user_1"] });
    const provider = createProvider({
      subscriptions: {
        sub_down: {
          id: "sub_down",
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
        eventId: "evt_down_trial",
        resourceId: "sub_down",
      }),
      {
        store,
        provider,
        subscriptionMode: "user",
      }
    );

    expect(outcome.status).toBe("processed");
    expect(store.userMemberships.get("user_1")).toMatchObject({
      subscriptionId: "sub_down",
      subscriptionStatus: "active",
      subscriptionTier: "pro",
    });
    expect(provider.cancelSubscription).toHaveBeenCalledWith("sub_pro", true);
  });

  it("moves to the lower tier after the first real approved downgrade payment", async () => {
    const store = createStore({ users: ["user_1"] });
    const provider = createProvider({
      subscriptions: {
        sub_down: {
          id: "sub_down",
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
      payments: {
        pay_1: {
          id: "pay_1",
          status: "approved",
          amount: DOWNGRADE_AMOUNT,
          currency: "UYU",
          payerEmail: "user@example.com",
          subscriptionId: "sub_down",
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

    const outcome = await projectSubscriptionProviderEvent(paymentEnvelope(), {
      store,
      provider,
      subscriptionMode: "user",
    });

    expect(outcome.status).toBe("processed");
    expect(provider.adjustSubscriptionAmount).not.toHaveBeenCalled();
    expect(provider.cancelSubscription).not.toHaveBeenCalled();
    expect(store.userMemberships.get("user_1")).toMatchObject({
      subscriptionId: "sub_down",
      subscriptionStatus: "active",
      subscriptionTier: "basic",
    });
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
