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
  /**
   * Passed the Billing manager gate for the organization Membership target.
   * Routes set it from `requireOrganizationBillingManagerAccess`; it is
   * meaningless for a user Membership target.
   */
  isBillingManager: boolean;
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
  /**
   * What the provider actually charged for the current period. It can differ
   * from the catalog price after a prorated first Payment or a price edit, so
   * an Upgrade credits this. Null when the provider does not report it.
   */
  currentPeriodChargedAmount?: number | null;
};

export type FindCurrentSubscriptionInput = {
  membershipTarget: PlanChangeMembershipTarget;
  paymentProvider: string;
  paymentIntegrationId?: string;
};

/**
 * The Pending Plan change ledger. Rows are never deleted: every transition
 * moves `status` and records who and why, so billing history stays traceable.
 * At most one row per Subscription is `pending` at a time.
 */
export type PlanChangeStore = {
  /** Moves the Subscription's `pending` row to `canceled`; null when none. */
  cancelPendingPlanChange(
    subscriptionId: string,
    cancellation: PendingPlanChangeCancellationInput,
  ): Promise<PendingPlanChangeRecord | null>;
  /** Moves the Subscription's `pending` row to `activated`; null when none. */
  markPendingPlanChangeActivated(subscriptionId: string): Promise<PendingPlanChangeRecord | null>;
  /**
   * Counts one failed activation attempt on the Subscription's `pending` row
   * and keeps `error` as its reason. Once the count reaches `maxAttempts` the
   * row moves to `failed`. Returns the row after the update; null when none.
   */
  recordPendingPlanChangeActivationFailure(
    subscriptionId: string,
    failure: { error: string; maxAttempts: number },
  ): Promise<PendingPlanChangeRecord | null>;
  findCurrentSubscription(
    input: FindCurrentSubscriptionInput,
  ): Promise<PlanChangeCurrentSubscription | null>;
  findPendingPlanChange(subscriptionId: string): Promise<PendingPlanChangeRecord | null>;
  listActiveVisiblePricingCatalogPlans(paymentProvider: string): Promise<PlanChangeCatalogPlan[]>;
  moveMembershipToPlan(input: {
    membershipTarget: PlanChangeMembershipTarget;
    paymentId: string;
    subscriptionId: string;
    targetPlan: PlanChangeCatalogPlan;
  }): Promise<void>;
  /**
   * Stores a new `pending` row. An existing `pending` row for the same
   * Subscription is moved to `canceled` with reason `replaced` first.
   */
  savePendingPlanChange(input: NewPendingPlanChange): Promise<PendingPlanChangeRecord>;
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
  /** Null when the provider reports no current period bounds. */
  currentPeriod: {
    daysRemaining: number;
    totalDays: number;
  } | null;
  firstPayment: {
    amount: number;
    /** Upgrade credit for the unused part of the current period; 0 otherwise. */
    credit: number;
    currency: string;
    fullAmount: number;
  };
};

/**
 * What an App admin's Plan change does: an Admin tier override. It takes
 * effect immediately, charges nothing and leaves real Subscriptions untouched,
 * so there is no Current Subscription to price against and no proration.
 */
export type AdminTierOverridePlanChangePreview = {
  kind: "admin-tier-override-preview";
  membershipTarget: PlanChangeMembershipTarget;
  targetPlan: PlanChangeCatalogPlan;
  effectiveTiming: "immediately";
  paymentDue: null;
};

export type PendingPlanChangeStatus = "pending" | "activated" | "canceled" | "failed";

/**
 * Why a Pending Plan change was canceled:
 * - `user`: a Billing manager, Subscription owner or App admin canceled it.
 * - `replaced`: a newer accepted Plan change took its place.
 * - `current_subscription_canceled`: the Current Subscription ended instead of renewing.
 * - `renewal_failed`: the renewal payment failed, so there was nothing to activate on.
 */
export type PendingPlanChangeCancelReason =
  | "user"
  | "replaced"
  | "current_subscription_canceled"
  | "renewal_failed";

export type PendingPlanChangeCancellationInput = {
  /** Null when the system canceled it (replacement or renewal evidence). */
  canceledByUserId: string | null;
  reason: PendingPlanChangeCancelReason;
};

export type PendingPlanChangeRecord = {
  id: string;
  /** Who accepted it; null when it was reconciled from provider evidence. */
  acceptedByUserId: string | null;
  activationAttempts: number;
  canceledByUserId: string | null;
  direction: Exclude<PlanChangeDirection, "upgrade">;
  effectiveAt: Date | null;
  membershipTarget: PlanChangeMembershipTarget;
  providerConfirmedPlanChangeId: string;
  /** A cancel reason, or the last activation error for `pending`/`failed`. */
  reason: string | null;
  status: PendingPlanChangeStatus;
  subscriptionId: string;
  targetPlanSnapshot: PlanChangeCatalogPlan;
};

export type NewPendingPlanChange = Pick<
  PendingPlanChangeRecord,
  | "acceptedByUserId"
  | "direction"
  | "effectiveAt"
  | "membershipTarget"
  | "providerConfirmedPlanChangeId"
  | "subscriptionId"
  | "targetPlanSnapshot"
>;

/**
 * How many webhook deliveries may fail to activate a Pending Plan change
 * before it is marked `failed`. Each failure answers the webhook with an
 * error so the provider retries; there is no separate retry worker.
 */
export const MAX_PENDING_PLAN_CHANGE_ACTIVATION_ATTEMPTS = 5;

export type PlanChangePaymentStatus = "pending" | "confirmed";

export type PlanChangePaymentAdapter = {
  paymentProvider: string;
  paymentIntegrationId?: string;
  /** The Payment provider's capabilities; see `PaymentProviderCapabilities`. */
  capabilities: {
    cadenceChange: boolean;
  };
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
  | "findPendingPlanChange"
  | "markPendingPlanChangeActivated"
  | "moveMembershipToPlan"
  | "recordPendingPlanChangeActivationFailure"
>;

/**
 * `applied: false` means the provider accepted the request but did not
 * apply it (it would keep charging the old terms). Retrying does not help.
 */
export type PendingPlanChangeProviderOutcome =
  | { applied: true }
  | { applied: false; reason: string };

/**
 * The Payment provider side of activating a Pending Plan change: make the
 * Subscription charge `targetPlan`'s terms from the next charge. A thrown
 * error is transient and retried like any other activation failure.
 */
export type PendingPlanChangeProviderPort = {
  applyPlanChange(input: {
    subscriptionId: string;
    targetPlan: PlanChangeCatalogPlan;
  }): Promise<PendingPlanChangeProviderOutcome>;
};

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
  "findPendingPlanChange" | "listActiveVisiblePricingCatalogPlans" | "savePendingPlanChange"
>;

export type PlanChangeProjectionStore = PendingPlanChangeActivationStore &
  PlanChangeReconciliationStore & {
    /**
     * The most recently activated Plan change of a Subscription. Its target
     * plan is the Membership's tier from then on, because provider metadata
     * can keep naming the old plan (Mercado Pago's external reference, Polar's
     * checkout metadata).
     */
    findLatestActivatedPlanChange(subscriptionId: string): Promise<PendingPlanChangeRecord | null>;
  };

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
  /** `failed`: activation kept failing and the row was marked `failed`. */
  action: "activated" | "canceled" | "failed" | "skipped";
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
  | "unsupported_billing_cadence"
  | "unsupported_cadence_change"
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

function fail(code: PlanChangeErrorCode, message: string, statusCode = HTTP_BAD_REQUEST): never {
  throw new PlanChangeError(code, message, statusCode);
}

const SINGLE_INTERVAL_COUNT = 1;
const MONTHS_PER_YEAR = 12;

export type BillingCadenceInterval = {
  interval: string | null | undefined;
  intervalCount: number | null | undefined;
};

/**
 * The single mapping from a provider interval to a Billing cadence. Beztack
 * supports a subset of Billing cadence: monthly and yearly. Any other cadence
 * (weekly, every 2 months, ...) is unsupported and returns null, so callers
 * decide explicitly how to reject it instead of collapsing it silently.
 */
export function classifyBillingCadence(
  input: BillingCadenceInterval,
): PlanChangeBillingCadence | null {
  const interval = input.interval?.trim().toLowerCase();
  const intervalCount = input.intervalCount ?? SINGLE_INTERVAL_COUNT;

  if (interval === "month" && intervalCount === SINGLE_INTERVAL_COUNT) {
    return "monthly";
  }

  if (
    (interval === "year" && intervalCount === SINGLE_INTERVAL_COUNT) ||
    (interval === "month" && intervalCount === MONTHS_PER_YEAR)
  ) {
    return "yearly";
  }

  return null;
}

function readReportedBillingInterval(
  metadata: Record<string, unknown> | null | undefined,
): BillingCadenceInterval | null {
  const interval = metadata?.billingInterval;
  if (typeof interval !== "string" || interval.trim().length === 0) {
    return null;
  }

  const frequency = metadata?.billingFrequency;
  let intervalCount: number | undefined;
  if (typeof frequency === "number" && Number.isFinite(frequency)) {
    intervalCount = frequency;
  } else if (typeof frequency === "string" && frequency.trim().length > 0) {
    const parsed = Number(frequency);
    intervalCount = Number.isFinite(parsed) ? parsed : undefined;
  }

  return { interval, intervalCount };
}

/**
 * Billing cadence a Subscription's provider metadata reports
 * (`billingInterval` / `billingFrequency`). Undefined when the provider reports
 * none; null when it reports a cadence Beztack does not support.
 */
export function readSubscriptionBillingCadence(
  metadata: Record<string, unknown> | null | undefined,
): PlanChangeBillingCadence | null | undefined {
  const reported = readReportedBillingInterval(metadata);
  return reported ? classifyBillingCadence(reported) : undefined;
}

/**
 * Like `readSubscriptionBillingCadence`, for a Plan change request: an
 * unsupported reported cadence is refused with `409 unsupported_billing_cadence`.
 */
export function requireSubscriptionBillingCadence(
  metadata: Record<string, unknown> | null | undefined,
): PlanChangeBillingCadence | undefined {
  const cadence = readSubscriptionBillingCadence(metadata);
  if (cadence === null) {
    fail(
      "unsupported_billing_cadence",
      "Current Subscription has a Billing cadence Beztack does not support",
      HTTP_CONFLICT,
    );
  }

  return cadence;
}

function sameBillingCadence(
  left: PlanChangeBillingCadence,
  right: PlanChangeBillingCadence,
): boolean {
  return left === right;
}

function matchesCurrentPlan(
  plan: PlanChangeCatalogPlan,
  subscription: PlanChangeCurrentSubscription,
): boolean {
  if (subscription.planId && plan.id === subscription.planId) {
    return true;
  }

  if (subscription.providerPlanId && plan.providerPlanId === subscription.providerPlanId) {
    return true;
  }

  return Boolean(
    subscription.canonicalTierId &&
    subscription.billingCadence &&
    plan.canonicalTierId === subscription.canonicalTierId &&
    plan.billingCadence === subscription.billingCadence,
  );
}

function resolveCurrentPlan(
  plans: PlanChangeCatalogPlan[],
  subscription: PlanChangeCurrentSubscription,
): PlanChangeCatalogPlan {
  const matches = plans.filter((plan) => matchesCurrentPlan(plan, subscription));

  if (matches.length === 1) {
    return matches[0];
  }

  if (matches.length > 1) {
    fail(
      "invalid_current_subscription",
      "Current Subscription matches multiple Pricing catalog plans",
      HTTP_CONFLICT,
    );
  }

  fail(
    "invalid_current_subscription",
    "Current Subscription does not match an active visible Pricing catalog plan",
  );
}

function matchesTargetPlan(
  plan: PlanChangeCatalogPlan,
  target: PreviewPlanChangeInput["target"],
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
    plan.billingCadence === target.billingCadence,
  );
}

function resolveTargetPlan(
  plans: PlanChangeCatalogPlan[],
  target: PreviewPlanChangeInput["target"],
): PlanChangeCatalogPlan {
  const matches = plans.filter((plan) => matchesTargetPlan(plan, target));

  if (matches.length === 1) {
    return matches[0];
  }

  if (matches.length > 1) {
    fail(
      "invalid_target",
      "Target Plan change request matches multiple Pricing catalog plans",
      HTTP_CONFLICT,
    );
  }

  fail(
    "invalid_target",
    "Target Plan change request does not match an active visible Pricing catalog plan",
  );
}

function matchesReconciliationTargetPlan(
  plan: PlanChangeCatalogPlan,
  target: PlanChangeReconciliationTarget,
): boolean {
  if (target.planId) {
    const planMatches = plan.id === target.planId || plan.providerPlanId === target.planId;
    return target.billingCadence
      ? planMatches && plan.billingCadence === target.billingCadence
      : planMatches;
  }

  return Boolean(
    target.tierId &&
    target.billingCadence &&
    plan.canonicalTierId === target.tierId &&
    plan.billingCadence === target.billingCadence,
  );
}

function resolveReconciliationTargetPlan(
  plans: PlanChangeCatalogPlan[],
  target: PlanChangeReconciliationTarget,
): PlanChangeCatalogPlan {
  const matches = plans.filter((plan) => matchesReconciliationTargetPlan(plan, target));

  if (matches.length === 1) {
    return matches[0];
  }

  if (matches.length > 1) {
    fail(
      "invalid_target",
      "Provider-confirmed Plan change evidence matches multiple Pricing catalog plans",
      HTTP_CONFLICT,
    );
  }

  fail(
    "invalid_target",
    "Provider-confirmed Plan change evidence does not match an active visible Pricing catalog plan",
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
      "Current Subscription belongs to a different Payment provider",
    );
  }

  const subscriptionIntegrationId = input.currentSubscription.paymentIntegrationId ?? undefined;
  if (subscriptionIntegrationId !== input.paymentIntegrationId) {
    fail(
      "payment_integration_mismatch",
      "Current Subscription belongs to a different Payment integration",
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
    if (input.currentSubscription.subscriptionOwnerUserId === input.actor.userId) {
      return;
    }

    fail(
      "unauthorized_plan_change",
      "Plan change requires Subscription owner authorization",
      HTTP_FORBIDDEN,
    );
  }

  if (input.actor.isBillingManager) {
    return;
  }

  fail(
    "unauthorized_plan_change",
    "Plan change requires Billing manager authorization",
    HTTP_FORBIDDEN,
  );
}

function classifyPlanChange(
  currentPlan: PlanChangeCatalogPlan,
  targetPlan: PlanChangeCatalogPlan,
): PlanChangeDirection {
  if (targetPlan.tierRank > currentPlan.tierRank) {
    return "upgrade";
  }

  if (targetPlan.tierRank < currentPlan.tierRank) {
    return "downgrade";
  }

  if (!sameBillingCadence(currentPlan.billingCadence, targetPlan.billingCadence)) {
    return "cadence_change";
  }

  fail("not_a_plan_change", "Same-tier, same-Billing cadence request is not a Plan change");
}

function measureCurrentPeriod(
  currentSubscription: PlanChangeCurrentSubscription,
  now: Date,
): PlanChangePreview["currentPeriod"] {
  const { currentPeriodStart, currentPeriodEnd } = currentSubscription;
  if (!(currentPeriodStart && currentPeriodEnd)) {
    return null;
  }

  const totalMs = Math.max(
    currentPeriodEnd.getTime() - currentPeriodStart.getTime(),
    MILLISECONDS_PER_DAY,
  );
  const remainingMs = Math.max(currentPeriodEnd.getTime() - now.getTime(), 0);

  return {
    daysRemaining: Math.max(Math.ceil(remainingMs / MILLISECONDS_PER_DAY), 0),
    totalDays: Math.max(Math.ceil(totalMs / MILLISECONDS_PER_DAY), 1),
  };
}

/**
 * The value of the unused part of the current period. It is based on what was
 * actually charged for the period, falling back to the catalog price only when
 * the provider does not report the charge.
 */
function calculateUpgradeCredit(input: {
  currentPeriod: PlanChangePreview["currentPeriod"];
  currentPlan: PlanChangeCatalogPlan;
  currentSubscription: PlanChangeCurrentSubscription;
}): number {
  if (!input.currentPeriod) {
    return 0;
  }

  const charged = input.currentSubscription.currentPeriodChargedAmount;
  const periodAmount =
    typeof charged === "number" && charged > 0 ? charged : input.currentPlan.price.amount;
  const { daysRemaining, totalDays } = input.currentPeriod;

  return Math.round((periodAmount / totalDays) * daysRemaining);
}

/**
 * Plan change preview. For an App admin this is an Admin tier override
 * preview; everyone else gets the real change priced against their Current
 * Subscription.
 */
export async function previewPlanChange(
  input: PreviewPlanChangeInput,
): Promise<PlanChangePreview | AdminTierOverridePlanChangePreview> {
  if (input.actor.isAppAdmin) {
    const catalogPlans = await input.store.listActiveVisiblePricingCatalogPlans(
      input.paymentProvider,
    );
    return {
      kind: "admin-tier-override-preview",
      membershipTarget: input.membershipTarget,
      targetPlan: resolveTargetPlan(catalogPlans, input.target),
      effectiveTiming: "immediately",
      paymentDue: null,
    };
  }

  return priceSubscriptionPlanChange(input);
}

/** Prices a real Plan change against the Current Subscription. */
async function priceSubscriptionPlanChange(
  input: PreviewPlanChangeInput,
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
      "No Current Subscription exists for the Membership target",
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
  const currentPeriod = measureCurrentPeriod(currentSubscription, input.now?.() ?? new Date());
  // The credit can never exceed the first Payment it discounts.
  const credit =
    direction === "upgrade"
      ? Math.min(
          calculateUpgradeCredit({ currentPeriod, currentPlan, currentSubscription }),
          targetPlan.price.amount,
        )
      : 0;

  return {
    kind: "plan-change-preview",
    direction,
    membershipTarget: input.membershipTarget,
    currentSubscriptionId: currentSubscription.id,
    currentPlan,
    effectiveAt: currentSubscription.currentPeriodEnd ?? null,
    targetPlan,
    effectiveTiming: direction === "upgrade" ? "after_first_payment" : "next_renewal",
    currentPeriod,
    firstPayment: {
      amount: targetPlan.price.amount - credit,
      credit,
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
      "Plan change Payment Adapter belongs to a different Payment provider",
    );
  }

  if (input.paymentAdapter.paymentIntegrationId !== input.paymentIntegrationId) {
    fail(
      "payment_integration_mismatch",
      "Plan change Payment Adapter belongs to a different Payment integration",
    );
  }
}

export async function acceptPlanChange(
  input: PreviewPlanChangeInput & {
    paymentAdapter: PlanChangePaymentAdapter;
  },
): Promise<PlanChangeAcceptance> {
  assertPaymentAdapterMatches({
    paymentAdapter: input.paymentAdapter,
    paymentIntegrationId: input.paymentIntegrationId,
    paymentProvider: input.paymentProvider,
  });

  // Accepting always changes the real Subscription. App admins reach the
  // Admin tier override through the route, never through this function.
  const preview = await priceSubscriptionPlanChange(input);
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

  if (preview.direction === "cadence_change" && !input.paymentAdapter.capabilities.cadenceChange) {
    fail(
      "unsupported_cadence_change",
      "The Payment provider cannot change the Billing cadence of an existing Subscription",
      HTTP_CONFLICT,
    );
  }

  // A Downgrade or Cadence change waits for the renewal, as a Pending Plan change.
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
      acceptedByUserId: input.actor.userId,
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
      error instanceof Error ? error.message : "Pending Plan change could not be stored";
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
    input.evidence.currentSubscriptionId,
  );
  if (existingPendingPlanChange) {
    return {
      kind: "plan-change-reconciliation",
      currentSubscriptionId: input.evidence.currentSubscriptionId,
      pendingPlanChange: existingPendingPlanChange,
      providerConfirmedPlanChangeId: input.evidence.providerConfirmedPlanChangeId,
      status: "already_pending",
    };
  }

  try {
    const targetPlan = resolveReconciliationTargetPlan(
      await input.store.listActiveVisiblePricingCatalogPlans(input.evidence.paymentProvider),
      input.evidence.target,
    );
    const pendingPlanChange = await input.store.savePendingPlanChange({
      // Reconciled from provider evidence: no Beztack actor accepted it here.
      acceptedByUserId: null,
      direction: input.evidence.direction,
      effectiveAt: input.evidence.effectiveAt,
      membershipTarget: input.evidence.membershipTarget,
      providerConfirmedPlanChangeId: input.evidence.providerConfirmedPlanChangeId,
      subscriptionId: input.evidence.currentSubscriptionId,
      targetPlanSnapshot: targetPlan,
    });

    return {
      kind: "plan-change-reconciliation",
      currentSubscriptionId: input.evidence.currentSubscriptionId,
      pendingPlanChange,
      providerConfirmedPlanChangeId: input.evidence.providerConfirmedPlanChangeId,
      status: "stored_pending",
    };
  } catch (error) {
    return {
      kind: "plan-change-reconciliation",
      currentSubscriptionId: input.evidence.currentSubscriptionId,
      pendingPlanChange: null,
      providerConfirmedPlanChangeId: input.evidence.providerConfirmedPlanChangeId,
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
      "No Current Subscription exists for the Membership target",
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
    currentSubscription.id,
    { canceledByUserId: input.actor.userId, reason: "user" },
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
  /** Defaults to MAX_PENDING_PLAN_CHANGE_ACTIVATION_ATTEMPTS. */
  maxActivationAttempts?: number;
  /** Required: activating without telling the provider leaves it charging the old plan. */
  provider: PendingPlanChangeProviderPort;
  renewalEvidence: PendingPlanChangeRenewalEvidence;
  store: PendingPlanChangeActivationStore;
}): Promise<PendingPlanChangeActivation> {
  const pendingPlanChange = await input.store.findPendingPlanChange(input.currentSubscriptionId);
  if (!pendingPlanChange) {
    return {
      kind: "pending-plan-change-activation",
      action: "skipped",
      currentSubscriptionId: input.currentSubscriptionId,
      membershipMoved: false,
      pendingPlanChange: null,
    };
  }

  if (input.renewalEvidence.state === "canceled" || input.renewalEvidence.state === "failed") {
    const canceledPendingPlanChange = await input.store.cancelPendingPlanChange(
      input.currentSubscriptionId,
      {
        canceledByUserId: null,
        reason:
          input.renewalEvidence.state === "canceled"
            ? "current_subscription_canceled"
            : "renewal_failed",
      },
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

  try {
    // Provider first: if the Membership move then fails, the retry applies
    // the same terms again, which is harmless.
    const outcome = await input.provider.applyPlanChange({
      subscriptionId: input.currentSubscriptionId,
      targetPlan: pendingPlanChange.targetPlanSnapshot,
    });
    if (!outcome.applied) {
      const failed = await input.store.recordPendingPlanChangeActivationFailure(
        input.currentSubscriptionId,
        { error: outcome.reason, maxAttempts: 1 },
      );

      return {
        kind: "pending-plan-change-activation",
        action: "failed",
        currentSubscriptionId: input.currentSubscriptionId,
        membershipMoved: false,
        pendingPlanChange: failed ?? pendingPlanChange,
      };
    }

    await input.store.moveMembershipToPlan({
      membershipTarget: pendingPlanChange.membershipTarget,
      paymentId: input.renewalEvidence.paymentId ?? `renewal:${input.currentSubscriptionId}`,
      subscriptionId: input.currentSubscriptionId,
      targetPlan: pendingPlanChange.targetPlanSnapshot,
    });
  } catch (error) {
    const failedAttempt = await input.store.recordPendingPlanChangeActivationFailure(
      input.currentSubscriptionId,
      {
        error: error instanceof Error ? error.message : "Pending Plan change activation failed",
        maxAttempts: input.maxActivationAttempts ?? MAX_PENDING_PLAN_CHANGE_ACTIVATION_ATTEMPTS,
      },
    );
    if (failedAttempt?.status !== "failed") {
      // Still retryable: the caller answers the webhook with an error so the
      // provider delivers it again.
      throw error;
    }

    return {
      kind: "pending-plan-change-activation",
      action: "failed",
      currentSubscriptionId: input.currentSubscriptionId,
      membershipMoved: false,
      pendingPlanChange: failedAttempt,
    };
  }
  const activatedPendingPlanChange = await input.store.markPendingPlanChangeActivated(
    input.currentSubscriptionId,
  );

  return {
    kind: "pending-plan-change-activation",
    action: "activated",
    currentSubscriptionId: input.currentSubscriptionId,
    membershipMoved: true,
    pendingPlanChange: activatedPendingPlanChange ?? pendingPlanChange,
  };
}
