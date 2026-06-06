import { createHash } from "node:crypto";
import {
  activatePendingPlanChange,
  type PendingPlanChangeRecord,
  type PendingPlanChangeRenewalEvidence,
  type PlanChangeBillingCadence,
  type PlanChangeCatalogPlan,
  type PlanChangeProjectionStore,
  type PlanChangeReconciliation,
  type ProviderConfirmedPlanChangeEvidence,
  reconcileProviderConfirmedPlanChange,
} from "./plan-change";

type MembershipTargetType = "user" | "organization";

export type SubscriptionProjectionEventEnvelope = {
  provider: string;
  eventId?: string | number | null;
  deliveryId?: string | null;
  eventType: string;
  action?: string | null;
  resourceType?: "subscription" | "payment" | "unknown";
  resourceId?: string | null;
  rawPayload: unknown;
};

export type ProjectionSubscription = {
  id: string;
  providerSubscriptionId?: string | null;
  rawStatus: string;
  productId?: string | null;
  productName?: string | null;
  customerEmail?: string | null;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean | null;
  externalReference?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type ProjectionPayment = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  payerEmail?: string | null;
  externalReference?: string | null;
  subscriptionId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type SubscriptionProjectionProviderAdapter = {
  provider: string;
  getSubscription(
    subscriptionId: string
  ): Promise<ProjectionSubscription | null>;
  getPayment(paymentId: string): Promise<ProjectionPayment | null>;
  adjustSubscriptionAmount(
    subscriptionId: string,
    fullAmount: number
  ): Promise<void>;
  cancelSubscription(
    subscriptionId: string,
    immediately?: boolean
  ): Promise<void>;
};

export type WebhookLogRecord = {
  id: number;
  eventKey: string;
  status: string | null;
};

export type StoredProjectionSubscription = {
  id: string;
  provider: string;
  providerSubscriptionId: string | null;
  userId: string | null;
  organizationId: string | null;
  planId: string | null;
  status: string;
  externalReference: string | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean | null;
  metadata: Record<string, unknown> | null;
};

export type StoredProjectionPayment = {
  id: string;
  provider: string;
  providerPaymentId: string | null;
  userId: string | null;
  subscriptionId: string | null;
  status: string;
  amount: string;
  currency: string;
  metadata: Record<string, unknown> | null;
};

export type MembershipCacheUpdates = {
  subscriptionTier: string | null;
  subscriptionStatus: string;
  subscriptionId: string;
  subscriptionValidUntil: Date | null;
};

export type SubscriptionProjectionStore = {
  findWebhookLogByEventKey(eventKey: string): Promise<WebhookLogRecord | null>;
  createWebhookLog(input: {
    provider: string;
    eventType: string;
    resourceId: string | null;
    eventKey: string;
    rawPayload: unknown;
  }): Promise<WebhookLogRecord>;
  markWebhookLogReceived(id: number): Promise<void>;
  markWebhookLogProcessed(id: number): Promise<void>;
  markWebhookLogFailed(id: number, errorMessage: string): Promise<void>;
  upsertSubscription(input: StoredProjectionSubscription): Promise<void>;
  upsertPayment(input: StoredProjectionPayment): Promise<void>;
  findUserIdByEmail(email: string): Promise<string | null>;
  userExists(userId: string): Promise<boolean>;
  organizationExists(organizationId: string): Promise<boolean>;
  updateUserMembership(
    userId: string,
    updates: MembershipCacheUpdates
  ): Promise<void>;
  updateOrganizationMembership(
    organizationId: string,
    updates: MembershipCacheUpdates
  ): Promise<void>;
};

export type SubscriptionProjectionDependencies = {
  store: SubscriptionProjectionStore;
  provider: SubscriptionProjectionProviderAdapter;
  subscriptionMode: MembershipTargetType;
  planChangeStore?: PlanChangeProjectionStore;
  now?: () => Date;
};

export type SubscriptionProjectionOutcomeStatus =
  | "processed"
  | "skipped"
  | "duplicate"
  | "failed";

export type SubscriptionProjectionOutcome = {
  status: SubscriptionProjectionOutcomeStatus;
  provider: string;
  eventType: string;
  eventKey: string;
  warnings: string[];
  touched: {
    webhookLogId?: number;
    subscriptionId?: string;
    paymentId?: string;
    userId?: string;
    organizationId?: string;
    canceledSubscriptionId?: string;
    pendingPlanChangeId?: string;
  };
  error?: string;
};

type MembershipTarget = {
  type: MembershipTargetType;
  id: string;
};

type ProjectionWorkResult = {
  status: "processed" | "skipped";
  warnings: string[];
  touched: SubscriptionProjectionOutcome["touched"];
};

const ACTIVE_PROVIDER_STATUSES = new Set(["active", "authorized", "trialing"]);
const PAST_DUE_PROVIDER_STATUSES = new Set(["past_due", "unpaid"]);
const CANCELED_PROVIDER_STATUSES = new Set(["canceled", "cancelled"]);
const SINGLE_INTERVAL_COUNT = 1;
const MONTHS_PER_YEAR = 12;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(
    ([left], [right]) => left.localeCompare(right)
  );

  return `{${entries
    .map(
      ([key, entryValue]) =>
        `${JSON.stringify(key)}:${stableStringify(entryValue)}`
    )
    .join(",")}}`;
}

function hashRawPayload(rawPayload: unknown): string {
  return createHash("sha256").update(stableStringify(rawPayload)).digest("hex");
}

function readString(
  source: Record<string, unknown> | null | undefined,
  key: string
): string | undefined {
  const value = source?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readNumber(
  source: Record<string, unknown> | null | undefined,
  key: string
): number | undefined {
  const value = source?.[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return;
}

function readBoolean(
  source: Record<string, unknown> | null | undefined,
  key: string
): boolean {
  const value = source?.[key];
  return value === true || value === "true";
}

function normalizeRawStatus(status: string): string {
  return status.trim().toLowerCase();
}

export function deriveMembershipStatus(
  rawStatus: string,
  validUntil: Date | null,
  now: Date
): string {
  const normalized = normalizeRawStatus(rawStatus);

  if (ACTIVE_PROVIDER_STATUSES.has(normalized)) {
    return "active";
  }

  if (CANCELED_PROVIDER_STATUSES.has(normalized)) {
    return validUntil && validUntil > now ? "canceled" : "inactive";
  }

  if (PAST_DUE_PROVIDER_STATUSES.has(normalized)) {
    return "past_due";
  }

  if (normalized === "pending") {
    return "pending";
  }

  return "inactive";
}

export function createSubscriptionProjectionEventKey(
  envelope: SubscriptionProjectionEventEnvelope
): string {
  if (envelope.eventId !== undefined && envelope.eventId !== null) {
    return `${envelope.provider}:event:${String(envelope.eventId)}`;
  }

  if (envelope.deliveryId) {
    return `${envelope.provider}:delivery:${envelope.deliveryId}`;
  }

  return [
    envelope.provider,
    "fallback",
    envelope.eventType,
    envelope.action ?? "",
    envelope.resourceId ?? "",
    hashRawPayload(envelope.rawPayload),
  ].join(":");
}

async function resolveUserTarget(
  metadata: Record<string, unknown> | null | undefined,
  customerEmail: string | null | undefined,
  store: SubscriptionProjectionStore
): Promise<MembershipTarget | null> {
  const userId = readString(metadata, "userId");

  if (userId && (await store.userExists(userId))) {
    return { type: "user", id: userId };
  }

  if (customerEmail) {
    const userIdByEmail = await store.findUserIdByEmail(customerEmail);
    if (userIdByEmail) {
      return { type: "user", id: userIdByEmail };
    }
  }

  return null;
}

async function resolveOrganizationTarget(
  metadata: Record<string, unknown> | null | undefined,
  store: SubscriptionProjectionStore
): Promise<MembershipTarget | null> {
  const organizationId =
    readString(metadata, "organizationId") ??
    (readString(metadata, "referenceId") !== readString(metadata, "userId")
      ? readString(metadata, "referenceId")
      : undefined);

  if (organizationId && (await store.organizationExists(organizationId))) {
    return { type: "organization", id: organizationId };
  }

  return null;
}

function resolveMembershipTarget(options: {
  metadata: Record<string, unknown> | null | undefined;
  customerEmail?: string | null;
  mode: MembershipTargetType;
  store: SubscriptionProjectionStore;
}): Promise<MembershipTarget | null> {
  if (options.mode === "organization") {
    return resolveOrganizationTarget(options.metadata, options.store);
  }

  return resolveUserTarget(
    options.metadata,
    options.customerEmail,
    options.store
  );
}

function membershipTargetFromTouched(
  touched: SubscriptionProjectionOutcome["touched"],
  fallback: MembershipTarget | null
): MembershipTarget | null {
  if (touched.userId) {
    return { type: "user", id: touched.userId };
  }

  if (touched.organizationId) {
    return { type: "organization", id: touched.organizationId };
  }

  return fallback;
}

function buildStoredSubscription(options: {
  provider: string;
  subscription: ProjectionSubscription;
  target: MembershipTarget | null;
}): StoredProjectionSubscription {
  const { provider, subscription, target } = options;
  return {
    id: subscription.id,
    provider,
    providerSubscriptionId:
      subscription.providerSubscriptionId ?? subscription.id ?? null,
    userId: target?.type === "user" ? target.id : null,
    organizationId: target?.type === "organization" ? target.id : null,
    planId: null,
    status: subscription.rawStatus,
    externalReference: subscription.externalReference ?? null,
    currentPeriodStart: subscription.currentPeriodStart ?? null,
    currentPeriodEnd: subscription.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd ?? null,
    metadata: subscription.metadata ?? null,
  };
}

function resolveMembershipTier(options: {
  metadata: Record<string, unknown> | null | undefined;
  productName?: string | null;
}): string | null {
  return readString(options.metadata, "tier") ?? options.productName ?? null;
}

function resolvePendingPlanChangeRenewalState(
  rawStatus: string
): PendingPlanChangeRenewalEvidence["state"] {
  const normalized = normalizeRawStatus(rawStatus);

  if (ACTIVE_PROVIDER_STATUSES.has(normalized)) {
    return "renewed";
  }

  if (CANCELED_PROVIDER_STATUSES.has(normalized)) {
    return "canceled";
  }

  if (PAST_DUE_PROVIDER_STATUSES.has(normalized)) {
    return "failed";
  }

  if (normalized === "pending") {
    return "unchanged";
  }

  return "failed";
}

function readPlanChangeBillingCadence(
  metadata: Record<string, unknown> | null | undefined
): PlanChangeBillingCadence | undefined {
  const interval = readString(metadata, "billingInterval");
  const intervalCount = readNumber(metadata, "billingFrequency") ?? 1;

  if (interval === "month" && intervalCount === SINGLE_INTERVAL_COUNT) {
    return "monthly";
  }

  if (
    (interval === "year" && intervalCount === SINGLE_INTERVAL_COUNT) ||
    (interval === "month" && intervalCount === MONTHS_PER_YEAR)
  ) {
    return "yearly";
  }

  return;
}

function readProviderConfirmedPlanChangeEvidence(input: {
  provider: string;
  subscription: ProjectionSubscription;
  target: MembershipTarget | null;
}): ProviderConfirmedPlanChangeEvidence | null {
  if (!input.target) {
    return null;
  }

  const metadata = input.subscription.metadata;
  const direction = readString(metadata, "direction");
  const isDowngradeEvidence = readBoolean(metadata, "proratedDowngrade");
  let planChangeDirection:
    | ProviderConfirmedPlanChangeEvidence["direction"]
    | null = null;
  if (direction === "downgrade" || direction === "cadence_change") {
    planChangeDirection = direction;
  } else if (isDowngradeEvidence) {
    planChangeDirection = "downgrade";
  }
  if (!planChangeDirection) {
    return null;
  }

  const targetPlanId = readString(metadata, "targetPlanId");
  const providerConfirmedPlanChangeId =
    readString(metadata, "providerConfirmedPlanChangeId") ??
    targetPlanId ??
    input.subscription.productId;
  if (!providerConfirmedPlanChangeId) {
    return null;
  }

  return {
    currentSubscriptionId: input.subscription.id,
    direction: planChangeDirection,
    effectiveAt: input.subscription.currentPeriodEnd ?? null,
    membershipTarget: input.target,
    paymentProvider: input.provider,
    providerConfirmedPlanChangeId,
    target: {
      planId: targetPlanId ?? input.subscription.productId ?? undefined,
      tierId: readString(metadata, "tier"),
      billingCadence: readPlanChangeBillingCadence(metadata),
    },
  };
}

function reconcilePendingPlanChangeFromProjection(options: {
  planChangeStore?: PlanChangeProjectionStore;
  provider: string;
  subscription: ProjectionSubscription;
  target: MembershipTarget | null;
}): Promise<PlanChangeReconciliation | null> {
  if (!options.planChangeStore) {
    return Promise.resolve(null);
  }

  const evidence = readProviderConfirmedPlanChangeEvidence({
    provider: options.provider,
    subscription: options.subscription,
    target: options.target,
  });
  if (!evidence) {
    return Promise.resolve(null);
  }

  return reconcileProviderConfirmedPlanChange({
    evidence,
    store: options.planChangeStore,
  });
}

async function activatePendingPlanChangeFromProjection(options: {
  now: Date;
  planChangeStore?: PlanChangeProjectionStore;
  subscription: ProjectionSubscription;
}): Promise<string | undefined> {
  if (!options.planChangeStore) {
    return;
  }

  const activation = await activatePendingPlanChange({
    currentSubscriptionId: options.subscription.id,
    renewalEvidence: {
      occurredAt: options.now,
      state: resolvePendingPlanChangeRenewalState(
        options.subscription.rawStatus
      ),
    },
    store: options.planChangeStore,
  });

  return activation.action === "skipped"
    ? undefined
    : activation.pendingPlanChange?.id;
}

async function projectMembershipCache(options: {
  store: SubscriptionProjectionStore;
  target: MembershipTarget | null;
  subscription: ProjectionSubscription;
  tier: string | null;
  now: Date;
}): Promise<string[]> {
  if (!options.target) {
    return [
      `Membership target could not be resolved for Subscription ${options.subscription.id}`,
    ];
  }

  const updates = {
    subscriptionTier: options.tier,
    subscriptionStatus: deriveMembershipStatus(
      options.subscription.rawStatus,
      options.subscription.currentPeriodEnd ?? null,
      options.now
    ),
    subscriptionId: options.subscription.id,
    subscriptionValidUntil: options.subscription.currentPeriodEnd ?? null,
  } satisfies MembershipCacheUpdates;

  if (options.target.type === "organization") {
    await options.store.updateOrganizationMembership(
      options.target.id,
      updates
    );
    return [];
  }

  await options.store.updateUserMembership(options.target.id, updates);
  return [];
}

async function projectSubscriptionResource(options: {
  provider: SubscriptionProjectionProviderAdapter;
  planChangeStore?: PlanChangeProjectionStore;
  store: SubscriptionProjectionStore;
  subscriptionId: string;
  subscriptionMode: MembershipTargetType;
  now: Date;
}): Promise<ProjectionWorkResult> {
  const subscription = await options.provider.getSubscription(
    options.subscriptionId
  );
  if (!subscription) {
    return {
      status: "skipped",
      warnings: [
        `Provider Subscription ${options.subscriptionId} was not found`,
      ],
      touched: {},
    };
  }

  const target = await resolveMembershipTarget({
    metadata: subscription.metadata,
    customerEmail: subscription.customerEmail,
    mode: options.subscriptionMode,
    store: options.store,
  });

  await options.store.upsertSubscription(
    buildStoredSubscription({
      provider: options.provider.provider,
      subscription,
      target,
    })
  );
  const reconciliation = await reconcilePendingPlanChangeFromProjection({
    planChangeStore: options.planChangeStore,
    provider: options.provider.provider,
    subscription,
    target,
  });

  const tier = resolveMembershipTier({
    metadata: subscription.metadata,
    productName: subscription.productName,
  });
  const warnings = await projectMembershipCache({
    store: options.store,
    target,
    subscription,
    tier,
    now: options.now,
  });
  if (reconciliation?.status === "reconciling") {
    warnings.push(
      `Plan change ${reconciliation.providerConfirmedPlanChangeId} is still reconciling: ${reconciliation.reason}`
    );
  }
  const pendingPlanChangeId = await activatePendingPlanChangeFromProjection({
    now: options.now,
    planChangeStore: options.planChangeStore,
    subscription,
  });

  const touched: SubscriptionProjectionOutcome["touched"] = {
    subscriptionId: subscription.id,
  };

  if (pendingPlanChangeId) {
    touched.pendingPlanChangeId = pendingPlanChangeId;
  } else if (reconciliation?.status === "stored_pending") {
    touched.pendingPlanChangeId = reconciliation.pendingPlanChange?.id;
  }

  if (target?.type === "user") {
    touched.userId = target.id;
  } else if (target?.type === "organization") {
    touched.organizationId = target.id;
  }

  return {
    status: "processed",
    warnings,
    touched,
  };
}

function buildStoredPayment(options: {
  provider: string;
  payment: ProjectionPayment;
  target: MembershipTarget | null;
  subscriptionPersisted: boolean;
}): StoredProjectionPayment {
  return {
    id: options.payment.id,
    provider: options.provider,
    providerPaymentId: options.payment.id,
    userId: options.target?.type === "user" ? options.target.id : null,
    subscriptionId: options.subscriptionPersisted
      ? (options.payment.subscriptionId ?? null)
      : null,
    status: options.payment.status,
    amount: String(options.payment.amount),
    currency: options.payment.currency,
    metadata: {
      ...(options.payment.metadata ?? {}),
      payerEmail: options.payment.payerEmail,
      externalReference: options.payment.externalReference,
    },
  };
}

async function projectApprovedPaymentSubscription(options: {
  provider: SubscriptionProjectionProviderAdapter;
  planChangeStore?: PlanChangeProjectionStore;
  store: SubscriptionProjectionStore;
  payment: ProjectionPayment;
  subscriptionMode: MembershipTargetType;
  now: Date;
  target: MembershipTarget | null;
}): Promise<{
  target: MembershipTarget | null;
  subscriptionPersisted: boolean;
  touched: SubscriptionProjectionOutcome["touched"];
  warnings: string[];
}> {
  if (
    options.payment.status !== "approved" ||
    !options.payment.subscriptionId
  ) {
    return {
      target: options.target,
      subscriptionPersisted: false,
      touched: {},
      warnings: [],
    };
  }

  const subscriptionResult = await projectSubscriptionResource({
    provider: options.provider,
    planChangeStore: options.planChangeStore,
    store: options.store,
    subscriptionId: options.payment.subscriptionId,
    subscriptionMode: options.subscriptionMode,
    now: options.now,
  });

  return {
    target: membershipTargetFromTouched(
      subscriptionResult.touched,
      options.target
    ),
    subscriptionPersisted: Boolean(subscriptionResult.touched.subscriptionId),
    touched: subscriptionResult.touched,
    warnings: subscriptionResult.warnings,
  };
}

async function applyApprovedPaymentFollowUps(options: {
  provider: SubscriptionProjectionProviderAdapter;
  payment: ProjectionPayment;
  subscriptionVerified: boolean;
}): Promise<SubscriptionProjectionOutcome["touched"]> {
  if (options.payment.status !== "approved" || !options.subscriptionVerified) {
    return {};
  }

  const touched: SubscriptionProjectionOutcome["touched"] = {};
  const fullAmount = readNumber(options.payment.metadata, "fullAmount");
  if (fullAmount && options.payment.subscriptionId) {
    await options.provider.adjustSubscriptionAmount(
      options.payment.subscriptionId,
      fullAmount
    );
  }

  const previousSubscriptionId = readString(
    options.payment.metadata,
    "previousSubscriptionId"
  );
  if (previousSubscriptionId) {
    await options.provider.cancelSubscription(previousSubscriptionId, true);
    touched.canceledSubscriptionId = previousSubscriptionId;
  }

  return touched;
}

async function projectPaymentResource(options: {
  provider: SubscriptionProjectionProviderAdapter;
  planChangeStore?: PlanChangeProjectionStore;
  store: SubscriptionProjectionStore;
  paymentId: string;
  subscriptionMode: MembershipTargetType;
  now: Date;
}): Promise<ProjectionWorkResult> {
  const payment = await options.provider.getPayment(options.paymentId);
  if (!payment) {
    return {
      status: "skipped",
      warnings: [`Provider Payment ${options.paymentId} was not found`],
      touched: {},
    };
  }

  const initialTarget = await resolveMembershipTarget({
    metadata: payment.metadata,
    customerEmail: payment.payerEmail,
    mode: options.subscriptionMode,
    store: options.store,
  });
  const subscriptionProjection = await projectApprovedPaymentSubscription({
    provider: options.provider,
    planChangeStore: options.planChangeStore,
    store: options.store,
    payment,
    subscriptionMode: options.subscriptionMode,
    now: options.now,
    target: initialTarget,
  });
  const target = subscriptionProjection.target;

  await options.store.upsertPayment(
    buildStoredPayment({
      provider: options.provider.provider,
      payment,
      target,
      subscriptionPersisted: subscriptionProjection.subscriptionPersisted,
    })
  );

  const touched: SubscriptionProjectionOutcome["touched"] = {
    paymentId: payment.id,
    ...subscriptionProjection.touched,
  };

  if (target?.type === "user") {
    touched.userId = target.id;
  } else if (target?.type === "organization") {
    touched.organizationId = target.id;
  }

  const followUpTouched = await applyApprovedPaymentFollowUps({
    provider: options.provider,
    payment,
    subscriptionVerified: subscriptionProjection.subscriptionPersisted,
  });

  return {
    status: "processed",
    warnings: subscriptionProjection.warnings,
    touched: { ...touched, ...followUpTouched },
  };
}

function resolveResourceType(
  envelope: SubscriptionProjectionEventEnvelope
): "subscription" | "payment" | "unknown" {
  if (envelope.resourceType) {
    return envelope.resourceType;
  }
  if (envelope.eventType.startsWith("payment.")) {
    return "payment";
  }
  if (envelope.eventType.startsWith("subscription.")) {
    return "subscription";
  }
  return "unknown";
}

function executeProjectionWork(options: {
  envelope: SubscriptionProjectionEventEnvelope;
  dependencies: SubscriptionProjectionDependencies;
  now: Date;
}): Promise<ProjectionWorkResult> {
  const resourceType = resolveResourceType(options.envelope);
  const resourceId = options.envelope.resourceId;

  if (!resourceId || resourceType === "unknown") {
    return Promise.resolve({
      status: "skipped",
      warnings: [
        `Projection skipped because ${options.envelope.eventType} did not include a supported resource`,
      ],
      touched: {},
    });
  }

  if (resourceType === "payment") {
    return projectPaymentResource({
      provider: options.dependencies.provider,
      planChangeStore: options.dependencies.planChangeStore,
      store: options.dependencies.store,
      paymentId: resourceId,
      subscriptionMode: options.dependencies.subscriptionMode,
      now: options.now,
    });
  }

  return projectSubscriptionResource({
    provider: options.dependencies.provider,
    planChangeStore: options.dependencies.planChangeStore,
    store: options.dependencies.store,
    subscriptionId: resourceId,
    subscriptionMode: options.dependencies.subscriptionMode,
    now: options.now,
  });
}

export async function projectSubscriptionProviderEvent(
  envelope: SubscriptionProjectionEventEnvelope,
  dependencies: SubscriptionProjectionDependencies
): Promise<SubscriptionProjectionOutcome> {
  const eventKey = createSubscriptionProjectionEventKey(envelope);
  const existingLog =
    await dependencies.store.findWebhookLogByEventKey(eventKey);

  if (existingLog?.status === "processed") {
    return {
      status: "duplicate",
      provider: envelope.provider,
      eventType: envelope.eventType,
      eventKey,
      warnings: [],
      touched: { webhookLogId: existingLog.id },
    };
  }

  const logEntry =
    existingLog ??
    (await dependencies.store.createWebhookLog({
      provider: envelope.provider,
      eventType: envelope.eventType,
      resourceId: envelope.resourceId ?? null,
      eventKey,
      rawPayload: envelope.rawPayload,
    }));

  await dependencies.store.markWebhookLogReceived(logEntry.id);

  try {
    const workResult = await executeProjectionWork({
      envelope,
      dependencies,
      now: dependencies.now?.() ?? new Date(),
    });

    await dependencies.store.markWebhookLogProcessed(logEntry.id);

    return {
      status: workResult.status,
      provider: envelope.provider,
      eventType: envelope.eventType,
      eventKey,
      warnings: workResult.warnings,
      touched: {
        webhookLogId: logEntry.id,
        ...workResult.touched,
      },
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    await dependencies.store.markWebhookLogFailed(logEntry.id, errorMessage);
    return {
      status: "failed",
      provider: envelope.provider,
      eventType: envelope.eventType,
      eventKey,
      warnings: [],
      touched: { webhookLogId: logEntry.id },
      error: errorMessage,
    };
  }
}

function getObjectPath(source: unknown, path: string[]): unknown {
  let current = source;
  for (const segment of path) {
    if (!isObject(current)) {
      return;
    }
    current = current[segment];
  }
  return current;
}

function readPayloadId(rawPayload: unknown): string | undefined {
  const dataId = getObjectPath(rawPayload, ["data", "id"]);
  if (typeof dataId === "string" || typeof dataId === "number") {
    return String(dataId);
  }

  return;
}

function readPayloadEventId(rawPayload: unknown): string | number | undefined {
  if (!isObject(rawPayload)) {
    return;
  }

  const id = rawPayload.id;
  return typeof id === "string" || typeof id === "number" ? id : undefined;
}

function readPayloadAction(rawPayload: unknown): string | undefined {
  if (!isObject(rawPayload)) {
    return;
  }

  return typeof rawPayload.action === "string" ? rawPayload.action : undefined;
}

function readPayloadType(rawPayload: unknown): string | undefined {
  if (!isObject(rawPayload)) {
    return;
  }

  return typeof rawPayload.type === "string" ? rawPayload.type : undefined;
}

function resolveMercadoPagoResourceType(
  type: string
): "subscription" | "payment" | "unknown" {
  if (type === "payment") {
    return "payment";
  }

  if (type === "subscription_preapproval") {
    return "subscription";
  }

  return "unknown";
}

function resolveWebhookPayloadResourceType(
  eventType: string
): "subscription" | "payment" | "unknown" {
  if (eventType.startsWith("payment.")) {
    return "payment";
  }

  if (eventType.startsWith("subscription.")) {
    return "subscription";
  }

  return "unknown";
}

export function createMercadoPagoProjectionEventEnvelope(
  payload: unknown,
  deliveryId?: string | null
): SubscriptionProjectionEventEnvelope {
  const type = readPayloadType(payload) ?? "unknown";
  const action = readPayloadAction(payload);
  const resourceType = resolveMercadoPagoResourceType(type);

  return {
    provider: "mercadopago",
    eventId: readPayloadEventId(payload),
    deliveryId,
    eventType: action ? `${type}.${action}` : type,
    action,
    resourceType,
    resourceId: readPayloadId(payload) ?? null,
    rawPayload: payload,
  };
}

export function createProjectionEventEnvelopeFromWebhookPayload(input: {
  provider: string;
  eventType: string;
  rawPayload: unknown;
  deliveryId?: string | null;
  subscriptionId?: string | null;
}): SubscriptionProjectionEventEnvelope {
  const resourceId = input.subscriptionId ?? readPayloadId(input.rawPayload);

  return {
    provider: input.provider,
    eventId: readPayloadEventId(input.rawPayload),
    deliveryId: input.deliveryId,
    eventType: input.eventType,
    action: readPayloadAction(input.rawPayload),
    resourceType: resolveWebhookPayloadResourceType(input.eventType),
    resourceId: resourceId ?? null,
    rawPayload: input.rawPayload,
  };
}

type PendingPlanChangeRow = {
  direction: string;
  effectiveAt: Date | null;
  id: string;
  membershipTargetId: string;
  membershipTargetType: string;
  providerConfirmedPlanChangeId: string;
  subscriptionId: string;
  targetPlanSnapshot: {
    id: string;
    paymentProvider: string;
    providerPlanId: string | null;
    canonicalTierId: string;
    tierRank: number;
    billingCadence: string;
    price: {
      amount: number;
      currency: string;
    };
  } | null;
};

function isPlanChangeBillingCadence(
  value: string
): value is PlanChangeBillingCadence {
  return value === "monthly" || value === "yearly";
}

function mapPendingDirection(
  direction: string
): PendingPlanChangeRecord["direction"] {
  if (direction === "downgrade" || direction === "cadence_change") {
    return direction;
  }

  throw new Error("Stored Pending Plan change has an invalid direction");
}

function mapPendingMembershipTarget(input: {
  id: string;
  type: string;
}): PendingPlanChangeRecord["membershipTarget"] {
  if (input.type === "user" || input.type === "organization") {
    return { type: input.type, id: input.id };
  }

  throw new Error(
    "Stored Pending Plan change has an invalid Membership target"
  );
}

function mapTargetPlanSnapshot(
  snapshot: PendingPlanChangeRow["targetPlanSnapshot"]
): PlanChangeCatalogPlan {
  if (!snapshot) {
    throw new Error("Stored Pending Plan change is missing its target Plan");
  }

  if (!isPlanChangeBillingCadence(snapshot.billingCadence)) {
    throw new Error(
      "Stored Pending Plan change target Plan has an invalid Billing cadence"
    );
  }

  return {
    ...snapshot,
    billingCadence: snapshot.billingCadence,
  };
}

function mapPendingPlanChangeRecord(
  row: PendingPlanChangeRow
): PendingPlanChangeRecord {
  return {
    direction: mapPendingDirection(row.direction),
    effectiveAt: row.effectiveAt,
    id: row.id,
    membershipTarget: mapPendingMembershipTarget({
      id: row.membershipTargetId,
      type: row.membershipTargetType,
    }),
    providerConfirmedPlanChangeId: row.providerConfirmedPlanChangeId,
    subscriptionId: row.subscriptionId,
    targetPlanSnapshot: mapTargetPlanSnapshot(row.targetPlanSnapshot),
  };
}

function mapPlanBillingCadence(input: {
  interval: string | null;
  intervalCount: number | null;
}): PlanChangeBillingCadence | null {
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

export async function createDbPendingPlanChangeActivationStore(): Promise<PlanChangeProjectionStore> {
  const [{ db, schema }, { and, eq }] = await Promise.all([
    import("@beztack/db"),
    import("drizzle-orm"),
  ]);

  const selectPendingPlanChangeFields = () => ({
    direction: schema.pendingPlanChange.direction,
    effectiveAt: schema.pendingPlanChange.effectiveAt,
    id: schema.pendingPlanChange.id,
    membershipTargetId: schema.pendingPlanChange.membershipTargetId,
    membershipTargetType: schema.pendingPlanChange.membershipTargetType,
    providerConfirmedPlanChangeId:
      schema.pendingPlanChange.providerConfirmedPlanChangeId,
    subscriptionId: schema.pendingPlanChange.subscriptionId,
    targetPlanSnapshot: schema.pendingPlanChange.targetPlanSnapshot,
  });

  const deletePendingPlanChange = async (
    subscriptionId: string
  ): Promise<PendingPlanChangeRecord | null> => {
    const [deletedPendingPlanChange] = await db
      .delete(schema.pendingPlanChange)
      .where(
        and(
          eq(schema.pendingPlanChange.subscriptionId, subscriptionId),
          eq(schema.pendingPlanChange.status, "pending")
        )
      )
      .returning(selectPendingPlanChangeFields());

    return deletedPendingPlanChange
      ? mapPendingPlanChangeRecord(deletedPendingPlanChange)
      : null;
  };

  return {
    cancelPendingPlanChange: deletePendingPlanChange,
    clearPendingPlanChange: deletePendingPlanChange,
    async findPendingPlanChange(subscriptionId) {
      const [pendingPlanChange] = await db
        .select(selectPendingPlanChangeFields())
        .from(schema.pendingPlanChange)
        .where(
          and(
            eq(schema.pendingPlanChange.subscriptionId, subscriptionId),
            eq(schema.pendingPlanChange.status, "pending")
          )
        )
        .limit(1);

      return pendingPlanChange
        ? mapPendingPlanChangeRecord(pendingPlanChange)
        : null;
    },
    async listActiveVisiblePricingCatalogPlans(paymentProvider) {
      const rows = await db
        .select({
          id: schema.plan.id,
          provider: schema.plan.provider,
          providerPlanId: schema.plan.providerPlanId,
          canonicalTierId: schema.plan.canonicalTierId,
          displayOrder: schema.plan.displayOrder,
          price: schema.plan.price,
          currency: schema.plan.currency,
          interval: schema.plan.interval,
          intervalCount: schema.plan.intervalCount,
        })
        .from(schema.plan)
        .where(
          and(
            eq(schema.plan.provider, paymentProvider),
            eq(schema.plan.visible, true),
            eq(schema.plan.status, "active")
          )
        );

      return rows.flatMap((row) => {
        const billingCadence = mapPlanBillingCadence(row);
        if (!billingCadence) {
          return [];
        }

        return [
          {
            id: row.id,
            paymentProvider: row.provider,
            providerPlanId: row.providerPlanId,
            canonicalTierId: row.canonicalTierId,
            tierRank: row.displayOrder ?? 0,
            billingCadence,
            price: {
              amount: Number(row.price),
              currency: row.currency,
            },
          },
        ];
      });
    },
    async moveMembershipToPlan(input) {
      const updates = {
        subscriptionTier: input.targetPlan.canonicalTierId,
        subscriptionStatus: "active",
        subscriptionId: input.subscriptionId,
      };

      if (input.membershipTarget.type === "organization") {
        await db
          .update(schema.organization)
          .set(updates)
          .where(eq(schema.organization.id, input.membershipTarget.id));
        return;
      }

      await db
        .update(schema.user)
        .set(updates)
        .where(eq(schema.user.id, input.membershipTarget.id));
    },
    savePendingPlanChange(input) {
      const id = `pending_${input.subscriptionId}`;
      const values = {
        direction: input.direction,
        effectiveAt: input.effectiveAt,
        id,
        membershipTargetId: input.membershipTarget.id,
        membershipTargetType: input.membershipTarget.type,
        providerConfirmedPlanChangeId: input.providerConfirmedPlanChangeId,
        status: "pending",
        subscriptionId: input.subscriptionId,
        targetPlanSnapshot: input.targetPlanSnapshot,
        updatedAt: new Date(),
      };

      return db
        .insert(schema.pendingPlanChange)
        .values(values)
        .onConflictDoUpdate({
          set: values,
          target: schema.pendingPlanChange.subscriptionId,
        })
        .then(() => ({
          id,
          ...input,
        }));
    },
  };
}

export async function createDbSubscriptionProjectionStore(): Promise<SubscriptionProjectionStore> {
  const [{ db, schema }, { eq }] = await Promise.all([
    import("@beztack/db"),
    import("drizzle-orm"),
  ]);

  const findWebhookLogByEventKey = async (
    eventKey: string
  ): Promise<WebhookLogRecord | null> => {
    const [log] = await db
      .select({
        id: schema.webhookLog.id,
        status: schema.webhookLog.status,
      })
      .from(schema.webhookLog)
      .where(eq(schema.webhookLog.eventKey, eventKey))
      .limit(1);

    return log ? { id: log.id, eventKey, status: log.status } : null;
  };

  return {
    findWebhookLogByEventKey,
    async createWebhookLog(input) {
      const [inserted] = await db
        .insert(schema.webhookLog)
        .values({
          provider: input.provider,
          eventType: input.eventType,
          resourceId: input.resourceId,
          eventKey: input.eventKey,
          rawPayload: input.rawPayload,
          status: "received",
          errorMessage: null,
          processedAt: null,
        })
        .onConflictDoNothing({ target: schema.webhookLog.eventKey })
        .returning({
          id: schema.webhookLog.id,
          eventKey: schema.webhookLog.eventKey,
          status: schema.webhookLog.status,
        });

      if (inserted) {
        return {
          id: inserted.id,
          eventKey: input.eventKey,
          status: inserted.status,
        };
      }

      const existing = await findWebhookLogByEventKey(input.eventKey);
      if (!existing) {
        throw new Error(`Could not create webhook log for ${input.eventKey}`);
      }
      return existing;
    },
    async markWebhookLogReceived(id) {
      await db
        .update(schema.webhookLog)
        .set({ status: "received", errorMessage: null })
        .where(eq(schema.webhookLog.id, id));
    },
    async markWebhookLogProcessed(id) {
      await db
        .update(schema.webhookLog)
        .set({
          status: "processed",
          processedAt: new Date(),
          errorMessage: null,
        })
        .where(eq(schema.webhookLog.id, id));
    },
    async markWebhookLogFailed(id, errorMessage) {
      await db
        .update(schema.webhookLog)
        .set({ status: "failed", processedAt: new Date(), errorMessage })
        .where(eq(schema.webhookLog.id, id));
    },
    async upsertSubscription(input) {
      const existing = await db
        .select({ id: schema.subscription.id })
        .from(schema.subscription)
        .where(eq(schema.subscription.id, input.id))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(schema.subscription).values(input);
        return;
      }

      await db
        .update(schema.subscription)
        .set(input)
        .where(eq(schema.subscription.id, input.id));
    },
    async upsertPayment(input) {
      const existing = await db
        .select({ id: schema.payment.id })
        .from(schema.payment)
        .where(eq(schema.payment.id, input.id))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(schema.payment).values(input);
        return;
      }

      await db
        .update(schema.payment)
        .set(input)
        .where(eq(schema.payment.id, input.id));
    },
    async findUserIdByEmail(email) {
      const [matchedUser] = await db
        .select({ id: schema.user.id })
        .from(schema.user)
        .where(eq(schema.user.email, email))
        .limit(1);

      return matchedUser?.id ?? null;
    },
    async userExists(userId) {
      const [matchedUser] = await db
        .select({ id: schema.user.id })
        .from(schema.user)
        .where(eq(schema.user.id, userId))
        .limit(1);

      return Boolean(matchedUser);
    },
    async organizationExists(organizationId) {
      const [matchedOrganization] = await db
        .select({ id: schema.organization.id })
        .from(schema.organization)
        .where(eq(schema.organization.id, organizationId))
        .limit(1);

      return Boolean(matchedOrganization);
    },
    async updateUserMembership(userId, updates) {
      await db
        .update(schema.user)
        .set(updates)
        .where(eq(schema.user.id, userId));
    },
    async updateOrganizationMembership(organizationId, updates) {
      await db
        .update(schema.organization)
        .set(updates)
        .where(eq(schema.organization.id, organizationId));
    },
  };
}

function mapInterval(frequencyType: string | undefined): string {
  return frequencyType === "days" ? "day" : "month";
}

function normalizeMercadoPagoApplicationId(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return null;
}

function requireMercadoPagoApplicationId(value: string): string {
  const applicationId = normalizeMercadoPagoApplicationId(value);
  if (!applicationId) {
    throw new Error(
      "MERCADO_PAGO_APPLICATION_ID is required when using Mercado Pago"
    );
  }
  return applicationId;
}

function belongsToMercadoPagoApplication(
  resource: { application_id?: unknown },
  expectedApplicationId: string
): boolean {
  return (
    normalizeMercadoPagoApplicationId(resource.application_id) ===
    expectedApplicationId
  );
}

function assertMercadoPagoApplicationResource(
  resource: { application_id?: unknown },
  expectedApplicationId: string
): void {
  if (belongsToMercadoPagoApplication(resource, expectedApplicationId)) {
    return;
  }

  throw new Error("Subscription not found");
}

export async function createMercadoPagoSubscriptionProjectionProvider(): Promise<SubscriptionProjectionProviderAdapter> {
  const [{ env }, mercadoPago, mercadoPagoServer] = await Promise.all([
    import("@/env"),
    import("@beztack/mercadopago"),
    import("@beztack/mercadopago/server"),
  ]);
  const client = mercadoPagoServer.createMercadoPagoClient({
    accessToken: env.MERCADO_PAGO_ACCESS_TOKEN,
    webhookSecret: env.MERCADO_PAGO_WEBHOOK_SECRET,
    integratorId: env.MERCADO_PAGO_INTEGRATOR_ID,
  });
  const applicationId = requireMercadoPagoApplicationId(
    env.MERCADO_PAGO_APPLICATION_ID
  );

  return {
    provider: "mercadopago",
    async getSubscription(subscriptionId) {
      const subscription = await client.subscriptions.get(subscriptionId);
      if (
        !(
          subscription.id &&
          belongsToMercadoPagoApplication(subscription, applicationId)
        )
      ) {
        return null;
      }
      const providerIntegrationId = normalizeMercadoPagoApplicationId(
        subscription.application_id
      );
      const metadata = mercadoPago.decodeExternalReference(
        subscription.external_reference
      );

      return {
        id: subscription.id,
        providerSubscriptionId: subscription.id,
        rawStatus: subscription.status ?? "unknown",
        productId: subscription.preapproval_plan_id ?? null,
        productName: subscription.reason ?? null,
        customerEmail: subscription.payer_email ?? null,
        currentPeriodStart: mercadoPagoServer.parseDate(
          subscription.date_created
        ),
        currentPeriodEnd: mercadoPagoServer.parseDate(
          subscription.next_payment_date
        ),
        cancelAtPeriodEnd: false,
        externalReference: subscription.external_reference ?? null,
        metadata: {
          ...(metadata ?? {}),
          ...(providerIntegrationId ? { providerIntegrationId } : {}),
          billingAmount: subscription.auto_recurring?.transaction_amount,
          billingCurrency: subscription.auto_recurring?.currency_id,
          billingInterval: mapInterval(
            subscription.auto_recurring?.frequency_type
          ),
          billingFrequency: subscription.auto_recurring?.frequency,
          payerEmail: subscription.payer_email,
          reason: subscription.reason,
        },
      };
    },
    async getPayment(paymentId) {
      const payment = await client.payments.get(paymentId);
      if (!payment.id) {
        return null;
      }
      const metadata = mercadoPago.decodeExternalReference(
        payment.external_reference
      );

      return {
        id: String(payment.id),
        status: payment.status ?? "unknown",
        amount: payment.transaction_amount ?? 0,
        currency: payment.currency_id ?? "UYU",
        payerEmail: payment.payer?.email ?? null,
        externalReference: payment.external_reference ?? null,
        subscriptionId:
          payment.point_of_interaction?.transaction_data?.subscription_id ??
          null,
        metadata: {
          ...(metadata ?? {}),
          statusDetail: payment.status_detail,
        },
      };
    },
    async adjustSubscriptionAmount(subscriptionId, fullAmount) {
      const subscription = await client.subscriptions.get(subscriptionId);
      assertMercadoPagoApplicationResource(subscription, applicationId);

      await client.subscriptions.update(subscriptionId, {
        auto_recurring: {
          transaction_amount: fullAmount,
        },
      });
    },
    async cancelSubscription(subscriptionId) {
      const subscription = await client.subscriptions.get(subscriptionId);
      assertMercadoPagoApplicationResource(subscription, applicationId);

      await client.subscriptions.cancel(subscriptionId);
    },
  };
}

export function createPaymentProviderSubscriptionProjectionProvider(provider: {
  provider: string;
  getSubscription(subscriptionId: string): Promise<{
    id: string;
    status: string;
    productId: string;
    productName?: string;
    customerEmail?: string;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
    cancelAtPeriodEnd?: boolean;
    metadata?: Record<string, unknown>;
  } | null>;
  cancelSubscription(
    subscriptionId: string,
    immediately?: boolean
  ): Promise<unknown>;
}): SubscriptionProjectionProviderAdapter {
  return {
    provider: provider.provider,
    async getSubscription(subscriptionId) {
      const subscription = await provider.getSubscription(subscriptionId);
      if (!subscription) {
        return null;
      }
      return {
        id: subscription.id,
        providerSubscriptionId: subscription.id,
        rawStatus: subscription.status,
        productId: subscription.productId,
        productName: subscription.productName,
        customerEmail: subscription.customerEmail,
        currentPeriodStart: subscription.currentPeriodStart ?? null,
        currentPeriodEnd: subscription.currentPeriodEnd ?? null,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd ?? null,
        metadata: subscription.metadata ?? null,
      };
    },
    getPayment() {
      return Promise.resolve(null);
    },
    adjustSubscriptionAmount() {
      return Promise.resolve();
    },
    async cancelSubscription(subscriptionId, immediately) {
      await provider.cancelSubscription(subscriptionId, immediately);
    },
  };
}

export async function getDefaultSubscriptionProjectionDependencies(provider?: {
  provider: string;
  getSubscription(subscriptionId: string): Promise<{
    id: string;
    status: string;
    productId: string;
    productName?: string;
    customerEmail?: string;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
    cancelAtPeriodEnd?: boolean;
    metadata?: Record<string, unknown>;
  } | null>;
  cancelSubscription(
    subscriptionId: string,
    immediately?: boolean
  ): Promise<unknown>;
}): Promise<SubscriptionProjectionDependencies> {
  const [{ env }, store, planChangeStore] = await Promise.all([
    import("@/env"),
    createDbSubscriptionProjectionStore(),
    createDbPendingPlanChangeActivationStore(),
  ]);
  const projectionProvider =
    provider?.provider === "mercadopago" || !provider
      ? await createMercadoPagoSubscriptionProjectionProvider()
      : createPaymentProviderSubscriptionProjectionProvider(provider);

  return {
    store,
    provider: projectionProvider,
    subscriptionMode: env.SUBSCRIPTION_MODE,
    planChangeStore,
  };
}
