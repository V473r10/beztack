export type PlanChangeBillingCadence = "monthly" | "yearly";
export type PlanChangeDirection = "upgrade" | "downgrade" | "cadence_change";
export type PlanChangeMembershipTarget = {
  type: "user" | "organization";
  id: string;
};

export type PlanChangeActor = {
  userId: string;
  email: string;
  isAppAdmin: boolean;
};

export type PlanChangeCatalogPlan = {
  id: string;
  paymentProvider: string;
  providerPlanId: string | null;
  canonicalTierId: string;
  tierRank: number;
  billingCadence: PlanChangeBillingCadence;
  price: {
    amount: number;
    currency: string;
  };
};

export type PlanChangeCurrentSubscription = {
  id: string;
  paymentProvider: string;
  paymentIntegrationId?: string | null;
  planId?: string | null;
  providerPlanId?: string | null;
  canonicalTierId?: string | null;
  billingCadence?: PlanChangeBillingCadence | null;
  subscriptionOwnerUserId?: string | null;
  organizationId?: string | null;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
};

export type FindCurrentSubscriptionInput = {
  membershipTarget: PlanChangeMembershipTarget;
  paymentProvider: string;
  paymentIntegrationId?: string;
};

export type PlanChangeStore = {
  cancelPendingPlanChange(
    subscriptionId: string
  ): Promise<PendingPlanChangeRecord | null>;
  clearPendingPlanChange(
    subscriptionId: string
  ): Promise<PendingPlanChangeRecord | null>;
  findCurrentSubscription(
    input: FindCurrentSubscriptionInput
  ): Promise<PlanChangeCurrentSubscription | null>;
  findPendingPlanChange(
    subscriptionId: string
  ): Promise<PendingPlanChangeRecord | null>;
  isBillingManager(input: {
    actorUserId: string;
    organizationId: string;
  }): Promise<boolean>;
  listActiveVisiblePricingCatalogPlans(
    paymentProvider: string
  ): Promise<PlanChangeCatalogPlan[]>;
  moveMembershipToPlan(input: {
    membershipTarget: PlanChangeMembershipTarget;
    paymentId: string;
    subscriptionId: string;
    targetPlan: PlanChangeCatalogPlan;
  }): Promise<void>;
  savePendingPlanChange(
    input: Omit<PendingPlanChangeRecord, "id">
  ): Promise<PendingPlanChangeRecord>;
};

export type PreviewPlanChangeInput = {
  actor: PlanChangeActor;
  membershipTarget: PlanChangeMembershipTarget;
  paymentProvider: string;
  paymentIntegrationId?: string;
  target: {
    planId?: string;
    tierId?: string;
    billingCadence: PlanChangeBillingCadence;
  };
  store: PlanChangeStore;
  now?: () => Date;
};

export type PlanChangeReconciliationTarget = {
  planId?: string;
  tierId?: string;
  billingCadence?: PlanChangeBillingCadence;
};

export type PlanChangePreview = {
  kind: "plan-change-preview";
  direction: PlanChangeDirection;
  membershipTarget: PlanChangeMembershipTarget;
  currentSubscriptionId: string;
  currentPlan: PlanChangeCatalogPlan;
  effectiveAt: Date | null;
  targetPlan: PlanChangeCatalogPlan;
  effectiveTiming: "after_first_payment" | "next_renewal";
  firstPayment: {
    amount: number;
    currency: string;
    fullAmount: number;
  };
};

export type PendingPlanChangeRecord = {
  id: string;
  direction: Exclude<PlanChangeDirection, "upgrade">;
  effectiveAt: Date | null;
  membershipTarget: PlanChangeMembershipTarget;
  providerConfirmedPlanChangeId: string;
  subscriptionId: string;
  targetPlanSnapshot: PlanChangeCatalogPlan;
};

export type PlanChangePaymentStatus = "pending" | "confirmed";

export type PlanChangePaymentAdapter = {
  paymentProvider: string;
  paymentIntegrationId?: string;
  confirmUpgrade(input: {
    actor: PlanChangeActor;
    currentPlan: PlanChangeCatalogPlan;
    currentSubscriptionId: string;
    firstPayment: PlanChangePreview["firstPayment"];
    membershipTarget: PlanChangeMembershipTarget;
    targetPlan: PlanChangeCatalogPlan;
  }): Promise<{
    firstPayment: {
      id: string;
      status: PlanChangePaymentStatus;
    };
    providerConfirmedPlanChangeId: string;
    redirectUrl?: string;
  }>;
  confirmPendingPlanChange(input: {
    actor: PlanChangeActor;
    currentPlan: PlanChangeCatalogPlan;
    currentSubscriptionId: string;
    direction: Exclude<PlanChangeDirection, "upgrade">;
    effectiveAt: Date | null;
    membershipTarget: PlanChangeMembershipTarget;
    targetPlan: PlanChangeCatalogPlan;
  }): Promise<{
    providerConfirmedPlanChangeId: string;
  }>;
};

export type PlanChangeAcceptance = {
  kind: "plan-change-acceptance";
  direction: PlanChangeDirection;
  currentSubscriptionId: string;
  firstPayment: {
    amount: number;
    currency: string;
    fullAmount: number;
    id: string;
    status: PlanChangePaymentStatus;
  };
  membershipMoved: boolean;
  pendingPlanChange?: PendingPlanChangeRecord;
  providerConfirmedPlanChangeId: string;
  reconciliationReason?: string;
  reconciliationStatus?: "settled" | "reconciling";
  redirectUrl?: string;
};

export type PendingPlanChangeCancellation = {
  kind: "pending-plan-change-cancellation";
  changed: boolean;
  canceledPendingPlanChange: PendingPlanChangeRecord | null;
  currentSubscriptionId: string;
};

export type PendingPlanChangeRenewalEvidence = {
  occurredAt: Date;
  paymentId?: string;
  state: "renewed" | "canceled" | "failed" | "unchanged";
};

export type PendingPlanChangeActivationStore = Pick<
  PlanChangeStore,
  | "cancelPendingPlanChange"
  | "clearPendingPlanChange"
  | "findPendingPlanChange"
  | "moveMembershipToPlan"
>;

export type ProviderConfirmedPlanChangeEvidence = {
  currentSubscriptionId: string;
  direction: Exclude<PlanChangeDirection, "upgrade">;
  effectiveAt: Date | null;
  membershipTarget: PlanChangeMembershipTarget;
  paymentProvider: string;
  providerConfirmedPlanChangeId: string;
  target: PlanChangeReconciliationTarget;
};

export type PlanChangeReconciliationStore = Pick<
  PlanChangeStore,
  | "findPendingPlanChange"
  | "listActiveVisiblePricingCatalogPlans"
  | "savePendingPlanChange"
>;

export type PlanChangeProjectionStore = PendingPlanChangeActivationStore &
  PlanChangeReconciliationStore;

export type PlanChangeReconciliation = {
  kind: "plan-change-reconciliation";
  currentSubscriptionId: string;
  pendingPlanChange: PendingPlanChangeRecord | null;
  providerConfirmedPlanChangeId: string;
  reason?: string;
  status: "already_pending" | "stored_pending" | "reconciling";
};

export type PendingPlanChangeActivation = {
  kind: "pending-plan-change-activation";
  action: "activated" | "canceled" | "skipped";
  currentSubscriptionId: string;
  membershipMoved: boolean;
  pendingPlanChange: PendingPlanChangeRecord | null;
};

export type PlanChangeErrorCode =
  | "invalid_current_subscription"
  | "invalid_target"
  | "missing_current_subscription"
  | "not_a_plan_change"
  | "payment_integration_mismatch"
  | "unsupported_plan_change_acceptance"
  | "unauthorized_plan_change";

export class PlanChangeError extends Error {
  code: PlanChangeErrorCode;
  statusCode: number;
  statusMessage: string;

  constructor(code: PlanChangeErrorCode, message: string, statusCode = 400) {
    super(message);
    this.name = "PlanChangeError";
    this.code = code;
    this.statusCode = statusCode;
    this.statusMessage = message;
  }
}

const HTTP_BAD_REQUEST = 400;
const HTTP_CONFLICT = 409;
const HTTP_FORBIDDEN = 403;
const MILLISECONDS_PER_DAY = 86_400_000;

function fail(
  code: PlanChangeErrorCode,
  message: string,
  statusCode = HTTP_BAD_REQUEST
): never {
  throw new PlanChangeError(code, message, statusCode);
}

function sameBillingCadence(
  left: PlanChangeBillingCadence,
  right: PlanChangeBillingCadence
): boolean {
  return left === right;
}

function matchesCurrentPlan(
  plan: PlanChangeCatalogPlan,
  subscription: PlanChangeCurrentSubscription
): boolean {
  if (subscription.planId && plan.id === subscription.planId) {
    return true;
  }

  if (
    subscription.providerPlanId &&
    plan.providerPlanId === subscription.providerPlanId
  ) {
    return true;
  }

  return Boolean(
    subscription.canonicalTierId &&
      subscription.billingCadence &&
      plan.canonicalTierId === subscription.canonicalTierId &&
      plan.billingCadence === subscription.billingCadence
  );
}

function resolveCurrentPlan(
  plans: PlanChangeCatalogPlan[],
  subscription: PlanChangeCurrentSubscription
): PlanChangeCatalogPlan {
  const matches = plans.filter((plan) =>
    matchesCurrentPlan(plan, subscription)
  );

  if (matches.length === 1) {
    return matches[0];
  }

  if (matches.length > 1) {
    fail(
      "invalid_current_subscription",
      "Current Subscription matches multiple Pricing catalog plans",
      HTTP_CONFLICT
    );
  }

  fail(
    "invalid_current_subscription",
    "Current Subscription does not match an active visible Pricing catalog plan"
  );
}

function matchesTargetPlan(
  plan: PlanChangeCatalogPlan,
  target: PreviewPlanChangeInput["target"]
): boolean {
  if (target.planId) {
    return (
      (plan.id === target.planId || plan.providerPlanId === target.planId) &&
      plan.billingCadence === target.billingCadence
    );
  }

  return Boolean(
    target.tierId &&
      plan.canonicalTierId === target.tierId &&
      plan.billingCadence === target.billingCadence
  );
}

function resolveTargetPlan(
  plans: PlanChangeCatalogPlan[],
  target: PreviewPlanChangeInput["target"]
): PlanChangeCatalogPlan {
  const matches = plans.filter((plan) => matchesTargetPlan(plan, target));

  if (matches.length === 1) {
    return matches[0];
  }

  if (matches.length > 1) {
    fail(
      "invalid_target",
      "Target Plan change request matches multiple Pricing catalog plans",
      HTTP_CONFLICT
    );
  }

  fail(
    "invalid_target",
    "Target Plan change request does not match an active visible Pricing catalog plan"
  );
}

function matchesReconciliationTargetPlan(
  plan: PlanChangeCatalogPlan,
  target: PlanChangeReconciliationTarget
): boolean {
  if (target.planId) {
    const planMatches =
      plan.id === target.planId || plan.providerPlanId === target.planId;
    return target.billingCadence
      ? planMatches && plan.billingCadence === target.billingCadence
      : planMatches;
  }

  return Boolean(
    target.tierId &&
      target.billingCadence &&
      plan.canonicalTierId === target.tierId &&
      plan.billingCadence === target.billingCadence
  );
}

function resolveReconciliationTargetPlan(
  plans: PlanChangeCatalogPlan[],
  target: PlanChangeReconciliationTarget
): PlanChangeCatalogPlan {
  const matches = plans.filter((plan) =>
    matchesReconciliationTargetPlan(plan, target)
  );

  if (matches.length === 1) {
    return matches[0];
  }

  if (matches.length > 1) {
    fail(
      "invalid_target",
      "Provider-confirmed Plan change evidence matches multiple Pricing catalog plans",
      HTTP_CONFLICT
    );
  }

  fail(
    "invalid_target",
    "Provider-confirmed Plan change evidence does not match an active visible Pricing catalog plan"
  );
}

function assertPaymentIntegrationMatches(input: {
  currentSubscription: PlanChangeCurrentSubscription;
  paymentIntegrationId?: string;
  paymentProvider: string;
}): void {
  if (input.currentSubscription.paymentProvider !== input.paymentProvider) {
    fail(
      "payment_integration_mismatch",
      "Current Subscription belongs to a different Payment provider"
    );
  }

  const subscriptionIntegrationId =
    input.currentSubscription.paymentIntegrationId ?? undefined;
  if (subscriptionIntegrationId !== input.paymentIntegrationId) {
    fail(
      "payment_integration_mismatch",
      "Current Subscription belongs to a different Payment integration"
    );
  }
}

async function assertAuthorizedForPlanChange(input: {
  actor: PlanChangeActor;
  currentSubscription: PlanChangeCurrentSubscription;
  membershipTarget: PlanChangeMembershipTarget;
  store: PlanChangeStore;
}): Promise<void> {
  if (input.actor.isAppAdmin) {
    return;
  }

  if (input.membershipTarget.type === "user") {
    if (
      input.currentSubscription.subscriptionOwnerUserId === input.actor.userId
    ) {
      return;
    }

    fail(
      "unauthorized_plan_change",
      "Plan change requires Subscription owner authorization",
      HTTP_FORBIDDEN
    );
  }

  const isBillingManager = await input.store.isBillingManager({
    actorUserId: input.actor.userId,
    organizationId: input.membershipTarget.id,
  });
  if (isBillingManager) {
    return;
  }

  fail(
    "unauthorized_plan_change",
    "Plan change requires Billing manager authorization",
    HTTP_FORBIDDEN
  );
}

function classifyPlanChange(
  currentPlan: PlanChangeCatalogPlan,
  targetPlan: PlanChangeCatalogPlan
): PlanChangeDirection {
  if (targetPlan.tierRank > currentPlan.tierRank) {
    return "upgrade";
  }

  if (targetPlan.tierRank < currentPlan.tierRank) {
    return "downgrade";
  }

  if (
    !sameBillingCadence(currentPlan.billingCadence, targetPlan.billingCadence)
  ) {
    return "cadence_change";
  }

  fail(
    "not_a_plan_change",
    "Same-tier, same-Billing cadence request is not a Plan change"
  );
}

function calculateProratedFirstPayment(input: {
  currentAmount: number;
  targetAmount: number;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  now: Date;
}): number {
  if (!(input.currentPeriodStart && input.currentPeriodEnd)) {
    return input.targetAmount;
  }

  const totalMs = Math.max(
    input.currentPeriodEnd.getTime() - input.currentPeriodStart.getTime(),
    MILLISECONDS_PER_DAY
  );
  const remainingMs = Math.max(
    input.currentPeriodEnd.getTime() - input.now.getTime(),
    0
  );
  const totalDays = Math.max(Math.ceil(totalMs / MILLISECONDS_PER_DAY), 1);
  const daysRemaining = Math.max(
    Math.ceil(remainingMs / MILLISECONDS_PER_DAY),
    0
  );
  const unusedCredit = Math.round(
    (input.currentAmount / totalDays) * daysRemaining
  );

  return Math.max(input.targetAmount - unusedCredit, 0);
}

export async function previewPlanChange(
  input: PreviewPlanChangeInput
): Promise<PlanChangePreview> {
  const [currentSubscription, catalogPlans] = await Promise.all([
    input.store.findCurrentSubscription({
      membershipTarget: input.membershipTarget,
      paymentProvider: input.paymentProvider,
      paymentIntegrationId: input.paymentIntegrationId,
    }),
    input.store.listActiveVisiblePricingCatalogPlans(input.paymentProvider),
  ]);

  if (!currentSubscription) {
    fail(
      "missing_current_subscription",
      "No Current Subscription exists for the Membership target"
    );
  }

  assertPaymentIntegrationMatches({
    currentSubscription,
    paymentIntegrationId: input.paymentIntegrationId,
    paymentProvider: input.paymentProvider,
  });

  await assertAuthorizedForPlanChange({
    actor: input.actor,
    currentSubscription,
    membershipTarget: input.membershipTarget,
    store: input.store,
  });

  const currentPlan = resolveCurrentPlan(catalogPlans, currentSubscription);
  const targetPlan = resolveTargetPlan(catalogPlans, input.target);
  const direction = classifyPlanChange(currentPlan, targetPlan);
  const firstPaymentAmount =
    direction === "upgrade"
      ? calculateProratedFirstPayment({
          currentAmount: currentPlan.price.amount,
          targetAmount: targetPlan.price.amount,
          currentPeriodStart: currentSubscription.currentPeriodStart,
          currentPeriodEnd: currentSubscription.currentPeriodEnd,
          now: input.now?.() ?? new Date(),
        })
      : targetPlan.price.amount;

  return {
    kind: "plan-change-preview",
    direction,
    membershipTarget: input.membershipTarget,
    currentSubscriptionId: currentSubscription.id,
    currentPlan,
    effectiveAt: currentSubscription.currentPeriodEnd ?? null,
    targetPlan,
    effectiveTiming:
      direction === "upgrade" ? "after_first_payment" : "next_renewal",
    firstPayment: {
      amount: firstPaymentAmount,
      currency: targetPlan.price.currency,
      fullAmount: targetPlan.price.amount,
    },
  };
}

function assertPaymentAdapterMatches(input: {
  paymentAdapter: PlanChangePaymentAdapter;
  paymentIntegrationId?: string;
  paymentProvider: string;
}): void {
  if (input.paymentAdapter.paymentProvider !== input.paymentProvider) {
    fail(
      "payment_integration_mismatch",
      "Plan change Payment Adapter belongs to a different Payment provider"
    );
  }

  if (
    input.paymentAdapter.paymentIntegrationId !== input.paymentIntegrationId
  ) {
    fail(
      "payment_integration_mismatch",
      "Plan change Payment Adapter belongs to a different Payment integration"
    );
  }
}

export async function acceptPlanChange(
  input: PreviewPlanChangeInput & {
    paymentAdapter: PlanChangePaymentAdapter;
  }
): Promise<PlanChangeAcceptance> {
  assertPaymentAdapterMatches({
    paymentAdapter: input.paymentAdapter,
    paymentIntegrationId: input.paymentIntegrationId,
    paymentProvider: input.paymentProvider,
  });

  const preview = await previewPlanChange(input);
  if (preview.direction === "upgrade") {
    const confirmation = await input.paymentAdapter.confirmUpgrade({
      actor: input.actor,
      currentPlan: preview.currentPlan,
      currentSubscriptionId: preview.currentSubscriptionId,
      firstPayment: preview.firstPayment,
      membershipTarget: preview.membershipTarget,
      targetPlan: preview.targetPlan,
    });
    const membershipMoved = confirmation.firstPayment.status === "confirmed";

    if (membershipMoved) {
      await input.store.moveMembershipToPlan({
        membershipTarget: preview.membershipTarget,
        paymentId: confirmation.firstPayment.id,
        subscriptionId: preview.currentSubscriptionId,
        targetPlan: preview.targetPlan,
      });
    }

    return {
      kind: "plan-change-acceptance",
      direction: preview.direction,
      currentSubscriptionId: preview.currentSubscriptionId,
      firstPayment: {
        ...preview.firstPayment,
        id: confirmation.firstPayment.id,
        status: confirmation.firstPayment.status,
      },
      membershipMoved,
      providerConfirmedPlanChangeId: confirmation.providerConfirmedPlanChangeId,
      redirectUrl: confirmation.redirectUrl,
    };
  }

  if (preview.direction !== "downgrade") {
    fail(
      "unsupported_plan_change_acceptance",
      "Only Upgrade and Downgrade acceptance are supported in this Plan change slice"
    );
  }

  const confirmation = await input.paymentAdapter.confirmPendingPlanChange({
    actor: input.actor,
    currentPlan: preview.currentPlan,
    currentSubscriptionId: preview.currentSubscriptionId,
    direction: preview.direction,
    effectiveAt: preview.effectiveAt,
    membershipTarget: preview.membershipTarget,
    targetPlan: preview.targetPlan,
  });
  let pendingPlanChange: PendingPlanChangeRecord | undefined;
  let reconciliationReason: string | undefined;
  let reconciliationStatus: "settled" | "reconciling" = "settled";

  try {
    pendingPlanChange = await input.store.savePendingPlanChange({
      direction: preview.direction,
      effectiveAt: preview.effectiveAt,
      membershipTarget: preview.membershipTarget,
      providerConfirmedPlanChangeId: confirmation.providerConfirmedPlanChangeId,
      subscriptionId: preview.currentSubscriptionId,
      targetPlanSnapshot: preview.targetPlan,
    });
  } catch (error) {
    reconciliationStatus = "reconciling";
    reconciliationReason =
      error instanceof Error
        ? error.message
        : "Pending Plan change could not be stored";
  }

  return {
    kind: "plan-change-acceptance",
    direction: preview.direction,
    currentSubscriptionId: preview.currentSubscriptionId,
    firstPayment: {
      ...preview.firstPayment,
      id: confirmation.providerConfirmedPlanChangeId,
      status: "confirmed",
    },
    membershipMoved: false,
    pendingPlanChange,
    providerConfirmedPlanChangeId: confirmation.providerConfirmedPlanChangeId,
    reconciliationReason,
    reconciliationStatus,
  };
}

export async function reconcileProviderConfirmedPlanChange(input: {
  evidence: ProviderConfirmedPlanChangeEvidence;
  store: PlanChangeReconciliationStore;
}): Promise<PlanChangeReconciliation> {
  const existingPendingPlanChange = await input.store.findPendingPlanChange(
    input.evidence.currentSubscriptionId
  );
  if (existingPendingPlanChange) {
    return {
      kind: "plan-change-reconciliation",
      currentSubscriptionId: input.evidence.currentSubscriptionId,
      pendingPlanChange: existingPendingPlanChange,
      providerConfirmedPlanChangeId:
        input.evidence.providerConfirmedPlanChangeId,
      status: "already_pending",
    };
  }

  try {
    const targetPlan = resolveReconciliationTargetPlan(
      await input.store.listActiveVisiblePricingCatalogPlans(
        input.evidence.paymentProvider
      ),
      input.evidence.target
    );
    const pendingPlanChange = await input.store.savePendingPlanChange({
      direction: input.evidence.direction,
      effectiveAt: input.evidence.effectiveAt,
      membershipTarget: input.evidence.membershipTarget,
      providerConfirmedPlanChangeId:
        input.evidence.providerConfirmedPlanChangeId,
      subscriptionId: input.evidence.currentSubscriptionId,
      targetPlanSnapshot: targetPlan,
    });

    return {
      kind: "plan-change-reconciliation",
      currentSubscriptionId: input.evidence.currentSubscriptionId,
      pendingPlanChange,
      providerConfirmedPlanChangeId:
        input.evidence.providerConfirmedPlanChangeId,
      status: "stored_pending",
    };
  } catch (error) {
    return {
      kind: "plan-change-reconciliation",
      currentSubscriptionId: input.evidence.currentSubscriptionId,
      pendingPlanChange: null,
      providerConfirmedPlanChangeId:
        input.evidence.providerConfirmedPlanChangeId,
      reason:
        error instanceof Error
          ? error.message
          : "Provider-confirmed Plan change could not be reconciled",
      status: "reconciling",
    };
  }
}

export async function cancelPendingPlanChange(input: {
  actor: PlanChangeActor;
  membershipTarget: PlanChangeMembershipTarget;
  paymentProvider: string;
  paymentIntegrationId?: string;
  store: PlanChangeStore;
}): Promise<PendingPlanChangeCancellation> {
  const currentSubscription = await input.store.findCurrentSubscription({
    membershipTarget: input.membershipTarget,
    paymentProvider: input.paymentProvider,
    paymentIntegrationId: input.paymentIntegrationId,
  });

  if (!currentSubscription) {
    fail(
      "missing_current_subscription",
      "No Current Subscription exists for the Membership target"
    );
  }

  assertPaymentIntegrationMatches({
    currentSubscription,
    paymentIntegrationId: input.paymentIntegrationId,
    paymentProvider: input.paymentProvider,
  });

  await assertAuthorizedForPlanChange({
    actor: input.actor,
    currentSubscription,
    membershipTarget: input.membershipTarget,
    store: input.store,
  });

  const canceledPendingPlanChange = await input.store.cancelPendingPlanChange(
    currentSubscription.id
  );

  return {
    kind: "pending-plan-change-cancellation",
    changed: Boolean(canceledPendingPlanChange),
    canceledPendingPlanChange,
    currentSubscriptionId: currentSubscription.id,
  };
}

export async function activatePendingPlanChange(input: {
  currentSubscriptionId: string;
  renewalEvidence: PendingPlanChangeRenewalEvidence;
  store: PendingPlanChangeActivationStore;
}): Promise<PendingPlanChangeActivation> {
  const pendingPlanChange = await input.store.findPendingPlanChange(
    input.currentSubscriptionId
  );
  if (!pendingPlanChange) {
    return {
      kind: "pending-plan-change-activation",
      action: "skipped",
      currentSubscriptionId: input.currentSubscriptionId,
      membershipMoved: false,
      pendingPlanChange: null,
    };
  }

  if (
    input.renewalEvidence.state === "canceled" ||
    input.renewalEvidence.state === "failed"
  ) {
    const canceledPendingPlanChange = await input.store.cancelPendingPlanChange(
      input.currentSubscriptionId
    );

    return {
      kind: "pending-plan-change-activation",
      action: "canceled",
      currentSubscriptionId: input.currentSubscriptionId,
      membershipMoved: false,
      pendingPlanChange: canceledPendingPlanChange ?? pendingPlanChange,
    };
  }

  if (input.renewalEvidence.state !== "renewed") {
    return {
      kind: "pending-plan-change-activation",
      action: "skipped",
      currentSubscriptionId: input.currentSubscriptionId,
      membershipMoved: false,
      pendingPlanChange,
    };
  }

  if (
    pendingPlanChange.effectiveAt &&
    input.renewalEvidence.occurredAt < pendingPlanChange.effectiveAt
  ) {
    return {
      kind: "pending-plan-change-activation",
      action: "skipped",
      currentSubscriptionId: input.currentSubscriptionId,
      membershipMoved: false,
      pendingPlanChange,
    };
  }

  await input.store.moveMembershipToPlan({
    membershipTarget: pendingPlanChange.membershipTarget,
    paymentId:
      input.renewalEvidence.paymentId ??
      `renewal:${input.currentSubscriptionId}`,
    subscriptionId: input.currentSubscriptionId,
    targetPlan: pendingPlanChange.targetPlanSnapshot,
  });
  const clearedPendingPlanChange = await input.store.clearPendingPlanChange(
    input.currentSubscriptionId
  );

  return {
    kind: "pending-plan-change-activation",
    action: "activated",
    currentSubscriptionId: input.currentSubscriptionId,
    membershipMoved: true,
    pendingPlanChange: clearedPendingPlanChange ?? pendingPlanChange,
  };
}
