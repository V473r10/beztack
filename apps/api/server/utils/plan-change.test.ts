import { describe, expect, it } from "vitest";
import {
  acceptPlanChange,
  activatePendingPlanChange,
  cancelPendingPlanChange,
  type PlanChangeCatalogPlan,
  type PlanChangeCurrentSubscription,
  type PlanChangeError,
  type PlanChangePaymentAdapter,
  type PlanChangeStore,
  previewPlanChange,
  reconcileProviderConfirmedPlanChange,
} from "./plan-change";

const MEMBERSHIP_TARGET = { type: "user", id: "user_1" } as const;
const ORGANIZATION_MEMBERSHIP_TARGET = {
  type: "organization",
  id: "org_1",
} as const;
const PAYMENT_PROVIDER = "mercadopago";
const PAYMENT_INTEGRATION_ID = "mp_app_1";
const PERIOD_START = new Date("2026-06-01T00:00:00.000Z");
const PERIOD_END = new Date("2026-07-01T00:00:00.000Z");
const AUTHORIZED_ACTOR = {
  email: "billing@example.com",
  isAppAdmin: false,
  userId: "user_1",
};

function catalogPlan(
  overrides: Partial<PlanChangeCatalogPlan> = {}
): PlanChangeCatalogPlan {
  return {
    id: "mercadopago_basic_month",
    paymentProvider: PAYMENT_PROVIDER,
    providerPlanId: "provider_basic_month",
    canonicalTierId: "basic",
    tierRank: 1,
    billingCadence: "monthly",
    price: { amount: 2900, currency: "UYU" },
    ...overrides,
  };
}

function createStore(options: {
  billingManagers?: string[];
  currentSubscription?: PlanChangeCurrentSubscription | null;
  existingPendingPlanChanges?: Array<
    Parameters<PlanChangeStore["savePendingPlanChange"]>[0] & { id: string }
  >;
  failSavePendingPlanChange?: boolean;
  operationLog?: string[];
  plans: PlanChangeCatalogPlan[];
}): PlanChangeStore & {
  membershipMoves: Parameters<PlanChangeStore["moveMembershipToPlan"]>[0][];
  pendingPlanChanges: Map<
    string,
    Parameters<PlanChangeStore["savePendingPlanChange"]>[0]
  >;
} {
  const billingManagers = new Set(options.billingManagers ?? []);
  const membershipMoves: Parameters<
    PlanChangeStore["moveMembershipToPlan"]
  >[0][] = [];
  const pendingPlanChanges = new Map<
    string,
    Parameters<PlanChangeStore["savePendingPlanChange"]>[0]
  >();
  for (const existingPendingPlanChange of options.existingPendingPlanChanges ??
    []) {
    pendingPlanChanges.set(
      existingPendingPlanChange.subscriptionId,
      existingPendingPlanChange
    );
  }

  return {
    membershipMoves,
    pendingPlanChanges,
    findCurrentSubscription() {
      return Promise.resolve(options.currentSubscription ?? null);
    },
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
    isBillingManager(input) {
      return Promise.resolve(
        billingManagers.has(`${input.organizationId}:${input.actorUserId}`)
      );
    },
    listActiveVisiblePricingCatalogPlans(paymentProvider) {
      return Promise.resolve(
        options.plans.filter((plan) => plan.paymentProvider === paymentProvider)
      );
    },
    moveMembershipToPlan(input) {
      membershipMoves.push(input);
      return Promise.resolve();
    },
    savePendingPlanChange(input) {
      options.operationLog?.push("store-pending");
      if (options.failSavePendingPlanChange) {
        throw new Error("database unavailable");
      }
      pendingPlanChanges.set(input.subscriptionId, input);
      return Promise.resolve({
        id: `pending_${input.subscriptionId}`,
        ...input,
      });
    },
  };
}

function pendingPlanChange(
  overrides: Partial<
    Parameters<PlanChangeStore["savePendingPlanChange"]>[0] & { id: string }
  > = {}
): Parameters<PlanChangeStore["savePendingPlanChange"]>[0] & { id: string } {
  return {
    id: "pending_sub_current",
    direction: "downgrade",
    effectiveAt: PERIOD_END,
    membershipTarget: MEMBERSHIP_TARGET,
    providerConfirmedPlanChangeId: "provider_pending_change_1",
    subscriptionId: "sub_current",
    targetPlanSnapshot: catalogPlan(),
    ...overrides,
  };
}

function createPaymentAdapter(
  firstPaymentStatus: "pending" | "confirmed" = "pending",
  operationLog?: string[],
  pendingPlanChangeId = "provider_pending_change_1"
): PlanChangePaymentAdapter & {
  pendingConfirmations: Parameters<
    PlanChangePaymentAdapter["confirmPendingPlanChange"]
  >[0][];
  upgradeConfirmations: Parameters<
    PlanChangePaymentAdapter["confirmUpgrade"]
  >[0][];
} {
  const pendingConfirmations: Parameters<
    PlanChangePaymentAdapter["confirmPendingPlanChange"]
  >[0][] = [];
  const upgradeConfirmations: Parameters<
    PlanChangePaymentAdapter["confirmUpgrade"]
  >[0][] = [];

  return {
    paymentIntegrationId: PAYMENT_INTEGRATION_ID,
    paymentProvider: PAYMENT_PROVIDER,
    pendingConfirmations,
    upgradeConfirmations,
    confirmPendingPlanChange(input) {
      operationLog?.push("provider-confirm");
      pendingConfirmations.push(input);
      return Promise.resolve({
        providerConfirmedPlanChangeId: pendingPlanChangeId,
      });
    },
    confirmUpgrade(input) {
      upgradeConfirmations.push(input);
      return Promise.resolve({
        firstPayment: {
          id: "pay_1",
          status: firstPaymentStatus,
        },
        providerConfirmedPlanChangeId: "provider_change_1",
        redirectUrl: "https://payments.example/confirm",
      });
    },
  };
}

function currentSubscription(
  overrides: Partial<PlanChangeCurrentSubscription> = {}
): PlanChangeCurrentSubscription {
  return {
    id: "sub_current",
    paymentProvider: PAYMENT_PROVIDER,
    paymentIntegrationId: PAYMENT_INTEGRATION_ID,
    planId: "mercadopago_basic_month",
    providerPlanId: "provider_basic_month",
    subscriptionOwnerUserId: "user_1",
    currentPeriodStart: PERIOD_START,
    currentPeriodEnd: PERIOD_END,
    ...overrides,
  };
}

async function readRejectedPlanChangeError(
  promise: Promise<unknown>
): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }

  throw new Error("Expected Plan change preview to fail");
}

describe("previewPlanChange", () => {
  it("classifies an Upgrade from Pricing catalog tier rank instead of provider price", async () => {
    const store = createStore({
      currentSubscription: currentSubscription(),
      plans: [
        catalogPlan(),
        catalogPlan({
          id: "mercadopago_pro_month",
          providerPlanId: "provider_pro_month",
          canonicalTierId: "pro",
          tierRank: 2,
          price: { amount: 1000, currency: "UYU" },
        }),
      ],
    });

    const preview = await previewPlanChange({
      actor: AUTHORIZED_ACTOR,
      membershipTarget: MEMBERSHIP_TARGET,
      paymentProvider: PAYMENT_PROVIDER,
      paymentIntegrationId: PAYMENT_INTEGRATION_ID,
      target: {
        tierId: "pro",
        billingCadence: "monthly",
      },
      store,
      now: () => new Date("2026-06-16T00:00:00.000Z"),
    });

    expect(preview).toMatchObject({
      kind: "plan-change-preview",
      direction: "upgrade",
      currentPlan: {
        canonicalTierId: "basic",
        billingCadence: "monthly",
      },
      targetPlan: {
        canonicalTierId: "pro",
        billingCadence: "monthly",
      },
    });
  });

  it("classifies a Downgrade from Pricing catalog tier rank instead of provider price", async () => {
    const store = createStore({
      currentSubscription: currentSubscription({
        planId: "mercadopago_pro_month",
        providerPlanId: "provider_pro_month",
      }),
      plans: [
        catalogPlan({ price: { amount: 5000, currency: "UYU" } }),
        catalogPlan({
          id: "mercadopago_pro_month",
          providerPlanId: "provider_pro_month",
          canonicalTierId: "pro",
          tierRank: 2,
          price: { amount: 1000, currency: "UYU" },
        }),
      ],
    });

    const preview = await previewPlanChange({
      actor: AUTHORIZED_ACTOR,
      membershipTarget: MEMBERSHIP_TARGET,
      paymentProvider: PAYMENT_PROVIDER,
      paymentIntegrationId: PAYMENT_INTEGRATION_ID,
      target: {
        tierId: "basic",
        billingCadence: "monthly",
      },
      store,
    });

    expect(preview).toMatchObject({
      direction: "downgrade",
      effectiveTiming: "next_renewal",
      firstPayment: {
        amount: 5000,
        currency: "UYU",
      },
    });
  });

  it("classifies a Cadence change when only Billing cadence changes", async () => {
    const store = createStore({
      currentSubscription: currentSubscription(),
      plans: [
        catalogPlan(),
        catalogPlan({
          id: "mercadopago_basic_year",
          providerPlanId: "provider_basic_year",
          billingCadence: "yearly",
          price: { amount: 29_000, currency: "UYU" },
        }),
      ],
    });

    const preview = await previewPlanChange({
      actor: AUTHORIZED_ACTOR,
      membershipTarget: MEMBERSHIP_TARGET,
      paymentProvider: PAYMENT_PROVIDER,
      paymentIntegrationId: PAYMENT_INTEGRATION_ID,
      target: {
        tierId: "basic",
        billingCadence: "yearly",
      },
      store,
    });

    expect(preview).toMatchObject({
      direction: "cadence_change",
      effectiveTiming: "next_renewal",
      currentPlan: { billingCadence: "monthly" },
      targetPlan: { billingCadence: "yearly" },
    });
  });

  it("fails clearly when the target Pricing catalog plan is invalid", async () => {
    const store = createStore({
      currentSubscription: currentSubscription(),
      plans: [catalogPlan()],
    });

    await expect(
      readRejectedPlanChangeError(
        previewPlanChange({
          actor: AUTHORIZED_ACTOR,
          membershipTarget: MEMBERSHIP_TARGET,
          paymentProvider: PAYMENT_PROVIDER,
          paymentIntegrationId: PAYMENT_INTEGRATION_ID,
          target: {
            tierId: "ultimate",
            billingCadence: "monthly",
          },
          store,
        })
      )
    ).resolves.toMatchObject({
      code: "invalid_target" satisfies PlanChangeError["code"],
      name: "PlanChangeError",
    });
  });

  it("fails clearly when there is no Current Subscription", async () => {
    const store = createStore({
      currentSubscription: null,
      plans: [catalogPlan()],
    });

    await expect(
      readRejectedPlanChangeError(
        previewPlanChange({
          actor: AUTHORIZED_ACTOR,
          membershipTarget: MEMBERSHIP_TARGET,
          paymentProvider: PAYMENT_PROVIDER,
          paymentIntegrationId: PAYMENT_INTEGRATION_ID,
          target: {
            tierId: "basic",
            billingCadence: "monthly",
          },
          store,
        })
      )
    ).resolves.toMatchObject({
      code: "missing_current_subscription" satisfies PlanChangeError["code"],
      name: "PlanChangeError",
    });
  });

  it("rejects a same-tier same-Billing cadence request as not a Plan change", async () => {
    const store = createStore({
      currentSubscription: currentSubscription(),
      plans: [catalogPlan()],
    });

    await expect(
      readRejectedPlanChangeError(
        previewPlanChange({
          actor: AUTHORIZED_ACTOR,
          membershipTarget: MEMBERSHIP_TARGET,
          paymentProvider: PAYMENT_PROVIDER,
          paymentIntegrationId: PAYMENT_INTEGRATION_ID,
          target: {
            tierId: "basic",
            billingCadence: "monthly",
          },
          store,
        })
      )
    ).resolves.toMatchObject({
      code: "not_a_plan_change" satisfies PlanChangeError["code"],
      name: "PlanChangeError",
    });
  });

  it("fails closed when the Current Subscription is from another Payment integration", async () => {
    const store = createStore({
      currentSubscription: currentSubscription({
        paymentIntegrationId: "mp_app_2",
      }),
      plans: [
        catalogPlan(),
        catalogPlan({
          id: "mercadopago_pro_month",
          providerPlanId: "provider_pro_month",
          canonicalTierId: "pro",
          tierRank: 2,
        }),
      ],
    });

    await expect(
      readRejectedPlanChangeError(
        previewPlanChange({
          actor: AUTHORIZED_ACTOR,
          membershipTarget: MEMBERSHIP_TARGET,
          paymentProvider: PAYMENT_PROVIDER,
          paymentIntegrationId: PAYMENT_INTEGRATION_ID,
          target: {
            tierId: "pro",
            billingCadence: "monthly",
          },
          store,
        })
      )
    ).resolves.toMatchObject({
      code: "payment_integration_mismatch" satisfies PlanChangeError["code"],
      name: "PlanChangeError",
    });
  });

  it("does not treat payer email alone as Subscription owner authorization", async () => {
    const store = createStore({
      currentSubscription: currentSubscription({
        subscriptionOwnerUserId: null,
      }),
      plans: [
        catalogPlan(),
        catalogPlan({
          id: "mercadopago_pro_month",
          providerPlanId: "provider_pro_month",
          canonicalTierId: "pro",
          tierRank: 2,
        }),
      ],
    });

    await expect(
      readRejectedPlanChangeError(
        previewPlanChange({
          actor: AUTHORIZED_ACTOR,
          membershipTarget: MEMBERSHIP_TARGET,
          paymentProvider: PAYMENT_PROVIDER,
          paymentIntegrationId: PAYMENT_INTEGRATION_ID,
          target: {
            tierId: "pro",
            billingCadence: "monthly",
          },
          store,
        })
      )
    ).resolves.toMatchObject({
      code: "unauthorized_plan_change" satisfies PlanChangeError["code"],
      name: "PlanChangeError",
    });
  });

  it("authorizes organization Plan changes for Billing managers", async () => {
    const store = createStore({
      billingManagers: ["org_1:user_1"],
      currentSubscription: currentSubscription({
        organizationId: "org_1",
        subscriptionOwnerUserId: null,
      }),
      plans: [
        catalogPlan(),
        catalogPlan({
          id: "mercadopago_pro_month",
          providerPlanId: "provider_pro_month",
          canonicalTierId: "pro",
          tierRank: 2,
        }),
      ],
    });

    const preview = await previewPlanChange({
      actor: AUTHORIZED_ACTOR,
      membershipTarget: ORGANIZATION_MEMBERSHIP_TARGET,
      paymentProvider: PAYMENT_PROVIDER,
      paymentIntegrationId: PAYMENT_INTEGRATION_ID,
      target: {
        tierId: "pro",
        billingCadence: "monthly",
      },
      store,
    });

    expect(preview.direction).toBe("upgrade");
  });

  it("rejects organization Plan changes when the actor is not a Billing manager", async () => {
    const store = createStore({
      currentSubscription: currentSubscription({
        organizationId: "org_1",
        subscriptionOwnerUserId: null,
      }),
      plans: [
        catalogPlan(),
        catalogPlan({
          id: "mercadopago_pro_month",
          providerPlanId: "provider_pro_month",
          canonicalTierId: "pro",
          tierRank: 2,
        }),
      ],
    });

    await expect(
      readRejectedPlanChangeError(
        previewPlanChange({
          actor: AUTHORIZED_ACTOR,
          membershipTarget: ORGANIZATION_MEMBERSHIP_TARGET,
          paymentProvider: PAYMENT_PROVIDER,
          paymentIntegrationId: PAYMENT_INTEGRATION_ID,
          target: {
            tierId: "pro",
            billingCadence: "monthly",
          },
          store,
        })
      )
    ).resolves.toMatchObject({
      code: "unauthorized_plan_change" satisfies PlanChangeError["code"],
      name: "PlanChangeError",
    });
  });

  it("authorizes App admins for real Subscription Plan changes", async () => {
    const store = createStore({
      currentSubscription: currentSubscription({
        subscriptionOwnerUserId: "other_user",
      }),
      plans: [
        catalogPlan(),
        catalogPlan({
          id: "mercadopago_pro_month",
          providerPlanId: "provider_pro_month",
          canonicalTierId: "pro",
          tierRank: 2,
        }),
      ],
    });

    const preview = await previewPlanChange({
      actor: {
        email: "admin@example.com",
        isAppAdmin: true,
        userId: "admin_1",
      },
      membershipTarget: MEMBERSHIP_TARGET,
      paymentProvider: PAYMENT_PROVIDER,
      paymentIntegrationId: PAYMENT_INTEGRATION_ID,
      target: {
        tierId: "pro",
        billingCadence: "monthly",
      },
      store,
    });

    expect(preview.direction).toBe("upgrade");
  });

  it("accepts an Upgrade through a narrow Payment Adapter without moving Membership before Payment confirmation", async () => {
    const store = createStore({
      currentSubscription: currentSubscription(),
      plans: [
        catalogPlan(),
        catalogPlan({
          id: "mercadopago_pro_month",
          providerPlanId: "provider_pro_month",
          canonicalTierId: "pro",
          tierRank: 2,
          price: { amount: 5000, currency: "UYU" },
        }),
      ],
    });
    const paymentAdapter = createPaymentAdapter("pending");

    const acceptance = await acceptPlanChange({
      actor: AUTHORIZED_ACTOR,
      membershipTarget: MEMBERSHIP_TARGET,
      paymentAdapter,
      paymentProvider: PAYMENT_PROVIDER,
      paymentIntegrationId: PAYMENT_INTEGRATION_ID,
      target: {
        tierId: "pro",
        billingCadence: "monthly",
      },
      store,
      now: () => new Date("2026-06-16T00:00:00.000Z"),
    });

    expect(paymentAdapter.upgradeConfirmations).toMatchObject([
      {
        currentSubscriptionId: "sub_current",
        firstPayment: {
          amount: 3550,
          currency: "UYU",
          fullAmount: 5000,
        },
        targetPlan: {
          canonicalTierId: "pro",
        },
      },
    ]);
    expect(acceptance).toMatchObject({
      direction: "upgrade",
      firstPayment: {
        status: "pending",
      },
      membershipMoved: false,
    });
    expect(store.membershipMoves).toEqual([]);
  });

  it("moves Membership for an Upgrade only after first Payment confirmation", async () => {
    const store = createStore({
      currentSubscription: currentSubscription(),
      plans: [
        catalogPlan(),
        catalogPlan({
          id: "mercadopago_pro_month",
          providerPlanId: "provider_pro_month",
          canonicalTierId: "pro",
          tierRank: 2,
          price: { amount: 5000, currency: "UYU" },
        }),
      ],
    });

    const acceptance = await acceptPlanChange({
      actor: AUTHORIZED_ACTOR,
      membershipTarget: MEMBERSHIP_TARGET,
      paymentAdapter: createPaymentAdapter("confirmed"),
      paymentProvider: PAYMENT_PROVIDER,
      paymentIntegrationId: PAYMENT_INTEGRATION_ID,
      target: {
        tierId: "pro",
        billingCadence: "monthly",
      },
      store,
      now: () => new Date("2026-06-16T00:00:00.000Z"),
    });

    expect(acceptance.membershipMoved).toBe(true);
    expect(store.membershipMoves).toMatchObject([
      {
        membershipTarget: MEMBERSHIP_TARGET,
        paymentId: "pay_1",
        subscriptionId: "sub_current",
        targetPlan: {
          billingCadence: "monthly",
          canonicalTierId: "pro",
        },
      },
    ]);
  });

  it("accepts a Downgrade by storing Beztack-owned Pending Plan change after provider confirmation", async () => {
    const operationLog: string[] = [];
    const store = createStore({
      currentSubscription: currentSubscription({
        planId: "mercadopago_pro_month",
        providerPlanId: "provider_pro_month",
      }),
      operationLog,
      plans: [
        catalogPlan(),
        catalogPlan({
          id: "mercadopago_pro_month",
          providerPlanId: "provider_pro_month",
          canonicalTierId: "pro",
          tierRank: 2,
          price: { amount: 5000, currency: "UYU" },
        }),
      ],
    });
    const paymentAdapter = createPaymentAdapter("pending", operationLog);

    const acceptance = await acceptPlanChange({
      actor: AUTHORIZED_ACTOR,
      membershipTarget: MEMBERSHIP_TARGET,
      paymentAdapter,
      paymentProvider: PAYMENT_PROVIDER,
      paymentIntegrationId: PAYMENT_INTEGRATION_ID,
      target: {
        tierId: "basic",
        billingCadence: "monthly",
      },
      store,
    });

    expect(operationLog).toEqual(["provider-confirm", "store-pending"]);
    expect(paymentAdapter.pendingConfirmations).toMatchObject([
      {
        currentSubscriptionId: "sub_current",
        direction: "downgrade",
        targetPlan: {
          canonicalTierId: "basic",
        },
      },
    ]);
    expect(store.pendingPlanChanges.get("sub_current")).toMatchObject({
      direction: "downgrade",
      providerConfirmedPlanChangeId: "provider_pending_change_1",
      subscriptionId: "sub_current",
      targetPlanSnapshot: {
        billingCadence: "monthly",
        canonicalTierId: "basic",
      },
    });
    expect(acceptance).toMatchObject({
      direction: "downgrade",
      membershipMoved: false,
      pendingPlanChange: {
        subscriptionId: "sub_current",
      },
    });
    expect(store.membershipMoves).toEqual([]);
  });

  it("replaces the existing Pending Plan change for a Subscription", async () => {
    const store = createStore({
      currentSubscription: currentSubscription({
        planId: "mercadopago_ultimate_month",
        providerPlanId: "provider_ultimate_month",
      }),
      plans: [
        catalogPlan(),
        catalogPlan({
          id: "mercadopago_pro_month",
          providerPlanId: "provider_pro_month",
          canonicalTierId: "pro",
          tierRank: 2,
        }),
        catalogPlan({
          id: "mercadopago_ultimate_month",
          providerPlanId: "provider_ultimate_month",
          canonicalTierId: "ultimate",
          tierRank: 3,
        }),
      ],
    });

    await acceptPlanChange({
      actor: AUTHORIZED_ACTOR,
      membershipTarget: MEMBERSHIP_TARGET,
      paymentAdapter: createPaymentAdapter(),
      paymentProvider: PAYMENT_PROVIDER,
      paymentIntegrationId: PAYMENT_INTEGRATION_ID,
      target: {
        tierId: "pro",
        billingCadence: "monthly",
      },
      store,
    });
    await acceptPlanChange({
      actor: AUTHORIZED_ACTOR,
      membershipTarget: MEMBERSHIP_TARGET,
      paymentAdapter: createPaymentAdapter(),
      paymentProvider: PAYMENT_PROVIDER,
      paymentIntegrationId: PAYMENT_INTEGRATION_ID,
      target: {
        tierId: "basic",
        billingCadence: "monthly",
      },
      store,
    });

    expect([...store.pendingPlanChanges]).toHaveLength(1);
    expect(store.pendingPlanChanges.get("sub_current")).toMatchObject({
      targetPlanSnapshot: {
        canonicalTierId: "basic",
      },
    });
  });

  it("fails Cadence change acceptance clearly without provider or Pending Plan change state", async () => {
    const store = createStore({
      currentSubscription: currentSubscription(),
      plans: [
        catalogPlan(),
        catalogPlan({
          id: "mercadopago_basic_year",
          providerPlanId: "provider_basic_year",
          billingCadence: "yearly",
          price: { amount: 29_000, currency: "UYU" },
        }),
      ],
    });
    const paymentAdapter = createPaymentAdapter();

    await expect(
      readRejectedPlanChangeError(
        acceptPlanChange({
          actor: AUTHORIZED_ACTOR,
          membershipTarget: MEMBERSHIP_TARGET,
          paymentAdapter,
          paymentProvider: PAYMENT_PROVIDER,
          paymentIntegrationId: PAYMENT_INTEGRATION_ID,
          target: {
            tierId: "basic",
            billingCadence: "yearly",
          },
          store,
        })
      )
    ).resolves.toMatchObject({
      code: "unsupported_plan_change_acceptance" satisfies PlanChangeError["code"],
      name: "PlanChangeError",
    });
    expect(paymentAdapter.pendingConfirmations).toEqual([]);
    expect(paymentAdapter.upgradeConfirmations).toEqual([]);
    expect(store.pendingPlanChanges).toEqual(new Map());
  });

  it("cancels an existing Pending Plan change for an authorized actor", async () => {
    const store = createStore({
      currentSubscription: currentSubscription(),
      existingPendingPlanChanges: [pendingPlanChange()],
      plans: [catalogPlan()],
    });

    const cancellation = await cancelPendingPlanChange({
      actor: AUTHORIZED_ACTOR,
      membershipTarget: MEMBERSHIP_TARGET,
      paymentProvider: PAYMENT_PROVIDER,
      paymentIntegrationId: PAYMENT_INTEGRATION_ID,
      store,
    });

    expect(cancellation).toMatchObject({
      changed: true,
      canceledPendingPlanChange: {
        subscriptionId: "sub_current",
      },
    });
    expect(store.pendingPlanChanges).toEqual(new Map());
    expect(store.membershipMoves).toEqual([]);
  });

  it("rejects Pending Plan change cancellation for an unauthorized actor", async () => {
    const existingPendingPlanChange = pendingPlanChange();
    const store = createStore({
      currentSubscription: currentSubscription({
        subscriptionOwnerUserId: "other_user",
      }),
      existingPendingPlanChanges: [existingPendingPlanChange],
      plans: [catalogPlan()],
    });

    await expect(
      readRejectedPlanChangeError(
        cancelPendingPlanChange({
          actor: AUTHORIZED_ACTOR,
          membershipTarget: MEMBERSHIP_TARGET,
          paymentProvider: PAYMENT_PROVIDER,
          paymentIntegrationId: PAYMENT_INTEGRATION_ID,
          store,
        })
      )
    ).resolves.toMatchObject({
      code: "unauthorized_plan_change" satisfies PlanChangeError["code"],
      name: "PlanChangeError",
    });
    expect(store.pendingPlanChanges.get("sub_current")).toBe(
      existingPendingPlanChange
    );
  });

  it("keeps one pending per Subscription after cancellation and later replacement", async () => {
    const store = createStore({
      currentSubscription: currentSubscription(),
      existingPendingPlanChanges: [pendingPlanChange()],
      plans: [
        catalogPlan(),
        catalogPlan({
          canonicalTierId: "free",
          id: "mercadopago_free_month",
          providerPlanId: "provider_free_month",
          price: { amount: 0, currency: "UYU" },
          tierRank: 0,
        }),
      ],
    });
    const paymentAdapter = createPaymentAdapter(
      "pending",
      undefined,
      "provider_pending_change_2"
    );

    await cancelPendingPlanChange({
      actor: AUTHORIZED_ACTOR,
      membershipTarget: MEMBERSHIP_TARGET,
      paymentProvider: PAYMENT_PROVIDER,
      paymentIntegrationId: PAYMENT_INTEGRATION_ID,
      store,
    });
    await acceptPlanChange({
      actor: AUTHORIZED_ACTOR,
      membershipTarget: MEMBERSHIP_TARGET,
      paymentAdapter,
      paymentProvider: PAYMENT_PROVIDER,
      paymentIntegrationId: PAYMENT_INTEGRATION_ID,
      target: {
        tierId: "free",
        billingCadence: "monthly",
      },
      store,
    });

    expect([...store.pendingPlanChanges]).toHaveLength(1);
    expect(store.pendingPlanChanges.get("sub_current")).toMatchObject({
      providerConfirmedPlanChangeId: "provider_pending_change_2",
      subscriptionId: "sub_current",
    });
    expect(store.membershipMoves).toEqual([]);
  });

  it("activates a Pending Plan change at renewal using the accepted target snapshot", async () => {
    const acceptedTargetSnapshot = catalogPlan({
      canonicalTierId: "basic",
      id: "mercadopago_basic_year",
      providerPlanId: "provider_basic_year",
      billingCadence: "yearly",
      price: { amount: 29_000, currency: "UYU" },
    });
    const store = createStore({
      currentSubscription: currentSubscription(),
      existingPendingPlanChanges: [
        pendingPlanChange({
          effectiveAt: PERIOD_END,
          targetPlanSnapshot: acceptedTargetSnapshot,
        }),
      ],
      plans: [catalogPlan()],
    });

    const activation = await activatePendingPlanChange({
      currentSubscriptionId: "sub_current",
      renewalEvidence: {
        occurredAt: new Date("2026-07-01T00:00:00.000Z"),
        paymentId: "pay_renewal_1",
        state: "renewed",
      },
      store,
    });

    expect(activation).toMatchObject({
      action: "activated",
      currentSubscriptionId: "sub_current",
      kind: "pending-plan-change-activation",
      membershipMoved: true,
    });
    expect(store.membershipMoves).toEqual([
      {
        membershipTarget: MEMBERSHIP_TARGET,
        paymentId: "pay_renewal_1",
        subscriptionId: "sub_current",
        targetPlan: acceptedTargetSnapshot,
      },
    ]);
    expect(store.pendingPlanChanges).toEqual(new Map());
  });

  it("does not activate a Pending Plan change before its effective time", async () => {
    const store = createStore({
      currentSubscription: currentSubscription(),
      existingPendingPlanChanges: [pendingPlanChange()],
      plans: [catalogPlan()],
    });

    const activation = await activatePendingPlanChange({
      currentSubscriptionId: "sub_current",
      renewalEvidence: {
        occurredAt: new Date("2026-06-15T00:00:00.000Z"),
        state: "renewed",
      },
      store,
    });

    expect(activation).toMatchObject({
      action: "skipped",
      membershipMoved: false,
    });
    expect(store.membershipMoves).toEqual([]);
    expect(store.pendingPlanChanges.get("sub_current")).toMatchObject({
      subscriptionId: "sub_current",
    });
  });

  it("cancels a Pending Plan change when Current Subscription renewal fails", async () => {
    const store = createStore({
      currentSubscription: currentSubscription(),
      existingPendingPlanChanges: [pendingPlanChange()],
      plans: [catalogPlan()],
    });

    const activation = await activatePendingPlanChange({
      currentSubscriptionId: "sub_current",
      renewalEvidence: {
        occurredAt: new Date("2026-07-01T00:00:00.000Z"),
        state: "failed",
      },
      store,
    });

    expect(activation).toMatchObject({
      action: "canceled",
      membershipMoved: false,
    });
    expect(store.membershipMoves).toEqual([]);
    expect(store.pendingPlanChanges).toEqual(new Map());
  });

  it("stores a missing Pending Plan change from provider-confirmed reconciliation evidence", async () => {
    const targetPlan = catalogPlan({
      id: "mercadopago_basic_year",
      providerPlanId: "provider_basic_year",
      billingCadence: "yearly",
      price: { amount: 29_000, currency: "UYU" },
    });
    const store = createStore({
      currentSubscription: currentSubscription(),
      plans: [catalogPlan(), targetPlan],
    });

    const reconciliation = await reconcileProviderConfirmedPlanChange({
      evidence: {
        currentSubscriptionId: "sub_current",
        direction: "downgrade",
        effectiveAt: PERIOD_END,
        membershipTarget: MEMBERSHIP_TARGET,
        paymentProvider: PAYMENT_PROVIDER,
        providerConfirmedPlanChangeId: "provider_basic_year",
        target: { planId: "provider_basic_year" },
      },
      store,
    });

    expect(reconciliation).toMatchObject({
      currentSubscriptionId: "sub_current",
      kind: "plan-change-reconciliation",
      providerConfirmedPlanChangeId: "provider_basic_year",
      status: "stored_pending",
    });
    expect(store.pendingPlanChanges.get("sub_current")).toMatchObject({
      providerConfirmedPlanChangeId: "provider_basic_year",
      targetPlanSnapshot: targetPlan,
    });
  });

  it("returns a clear reconciling state when missing Pending Plan change storage fails", async () => {
    const store = createStore({
      currentSubscription: currentSubscription(),
      failSavePendingPlanChange: true,
      plans: [catalogPlan()],
    });

    const reconciliation = await reconcileProviderConfirmedPlanChange({
      evidence: {
        currentSubscriptionId: "sub_current",
        direction: "downgrade",
        effectiveAt: PERIOD_END,
        membershipTarget: MEMBERSHIP_TARGET,
        paymentProvider: PAYMENT_PROVIDER,
        providerConfirmedPlanChangeId: "provider_basic_month",
        target: { planId: "provider_basic_month" },
      },
      store,
    });

    expect(reconciliation).toMatchObject({
      currentSubscriptionId: "sub_current",
      kind: "plan-change-reconciliation",
      providerConfirmedPlanChangeId: "provider_basic_month",
      reason: "database unavailable",
      status: "reconciling",
    });
    expect(store.pendingPlanChanges).toEqual(new Map());
  });

  it("returns a reconciling acceptance response when provider confirmation succeeds but Beztack persistence fails", async () => {
    const store = createStore({
      currentSubscription: currentSubscription({
        planId: "mercadopago_pro_month",
        providerPlanId: "provider_pro_month",
        canonicalTierId: "pro",
      }),
      failSavePendingPlanChange: true,
      plans: [
        catalogPlan({
          id: "mercadopago_pro_month",
          providerPlanId: "provider_pro_month",
          canonicalTierId: "pro",
          price: { amount: 5900, currency: "UYU" },
          tierRank: 2,
        }),
        catalogPlan(),
      ],
    });

    const acceptance = await acceptPlanChange({
      actor: AUTHORIZED_ACTOR,
      membershipTarget: MEMBERSHIP_TARGET,
      paymentAdapter: createPaymentAdapter(),
      paymentProvider: PAYMENT_PROVIDER,
      paymentIntegrationId: PAYMENT_INTEGRATION_ID,
      target: {
        tierId: "basic",
        billingCadence: "monthly",
      },
      store,
    });

    expect(acceptance).toMatchObject({
      direction: "downgrade",
      membershipMoved: false,
      providerConfirmedPlanChangeId: "provider_pending_change_1",
      reconciliationReason: "database unavailable",
      reconciliationStatus: "reconciling",
    });
    expect(acceptance.pendingPlanChange).toBeUndefined();
  });
});
