import {
  adminTierOverride,
  adminTierOverrideAudit,
  db,
  member as memberTable,
  plan as planTable,
} from "@beztack/db";
import { and, eq } from "drizzle-orm";

export type AdminTierOverrideTargetType = "user" | "organization";
export type AdminTierOverrideBillingCadence = "monthly" | "yearly";
export type AdminTierOverrideTier =
  | "free"
  | "basic"
  | "pro"
  | "ultimate"
  | "enterprise";

export type AdminTierOverrideTarget = {
  type: AdminTierOverrideTargetType;
  id: string;
};

export type OverrideCatalogPlan = {
  id: string;
  provider: string;
  providerPlanId: string | null;
  canonicalTierId: string;
  price: number;
  interval: string | null;
  intervalCount: number | null;
  visible: boolean;
  status: string | null;
};

export type AdminTierOverrideRecord = {
  id: number;
  targetType: AdminTierOverrideTargetType;
  targetId: string;
  tier: AdminTierOverrideTier;
  billingCadence: AdminTierOverrideBillingCadence | null;
  actorUserId: string;
  sourceAction: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type OverrideAuditEntry = {
  id: number;
  action: "apply" | "clear";
  targetType: AdminTierOverrideTargetType;
  targetId: string;
  tier: AdminTierOverrideTier;
  billingCadence: AdminTierOverrideBillingCadence | null;
  actorUserId: string;
  sourceAction: string | null;
  createdAt: Date;
};

export type AdminTierOverrideStore = {
  listActiveVisibleCatalogPlans(
    provider: string
  ): Promise<OverrideCatalogPlan[]>;
  findOverride(
    target: AdminTierOverrideTarget
  ): Promise<AdminTierOverrideRecord | null>;
  saveOverride(input: {
    target: AdminTierOverrideTarget;
    tier: AdminTierOverrideTier;
    billingCadence: AdminTierOverrideBillingCadence | null;
    actorUserId: string;
    sourceAction: string | null;
    now: Date;
  }): Promise<AdminTierOverrideRecord>;
  deleteOverride(
    target: AdminTierOverrideTarget
  ): Promise<AdminTierOverrideRecord | null>;
  createAuditEntry(input: Omit<OverrideAuditEntry, "id">): Promise<void>;
  isOrganizationMember(
    userId: string,
    organizationId: string
  ): Promise<boolean>;
};

export type AdminTierOverrideActor = {
  id: string;
  email: string;
  role?: string | string[] | null;
};

export type ApplyAdminTierOverrideInput = {
  actor: AdminTierOverrideActor;
  appAdminEmails: string[];
  billingPeriod: AdminTierOverrideBillingCadence;
  organizationId?: string;
  planId?: string;
  productId?: string;
  provider: string;
  sourceAction: string;
  store?: AdminTierOverrideStore;
  subscriptionMode: AdminTierOverrideTargetType;
  userId: string;
  now?: () => Date;
};

export type ApplyAdminTierOverrideResult = {
  kind: "admin-tier-override";
  changed: boolean;
  override: AdminTierOverrideRecord;
  target: AdminTierOverrideTarget;
};

export class AdminTierOverrideError extends Error {
  statusCode: number;
  statusMessage: string;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "AdminTierOverrideError";
    this.statusCode = statusCode;
    this.statusMessage = message;
  }
}

const VALID_TIERS = new Set<AdminTierOverrideTier>([
  "free",
  "basic",
  "pro",
  "ultimate",
  "enterprise",
]);
const HTTP_BAD_REQUEST = 400;
const HTTP_FORBIDDEN = 403;
const HTTP_CONFLICT = 409;
const SINGLE_INTERVAL_COUNT = 1;
const MONTHS_PER_YEAR = 12;

function normalizeAppAdminEmails(emails: string[]): string[] {
  return emails.map((email) => email.trim().toLowerCase()).filter(Boolean);
}

function hasAppAdminRole(role: AdminTierOverrideActor["role"]): boolean {
  console.log(role);
  return role?.includes("sudo") ?? false;
}

export function isAppAdminActor(
  actor: AdminTierOverrideActor,
  appAdminEmails: string[]
): boolean {
  if (!hasAppAdminRole(actor.role)) {
    return false;
  }

  return normalizeAppAdminEmails(appAdminEmails).includes(
    actor.email.trim().toLowerCase()
  );
}

function parseTier(value: string): AdminTierOverrideTier {
  const normalized = value.trim().toLowerCase();
  if (VALID_TIERS.has(normalized as AdminTierOverrideTier)) {
    return normalized as AdminTierOverrideTier;
  }

  throw new AdminTierOverrideError(
    HTTP_BAD_REQUEST,
    `Unsupported Pricing catalog tier: ${value}`
  );
}

function resolvePlanCadence(
  plan: OverrideCatalogPlan
): AdminTierOverrideBillingCadence | null {
  if (plan.canonicalTierId === "free") {
    return null;
  }

  const interval = plan.interval?.trim().toLowerCase();
  const intervalCount = plan.intervalCount ?? SINGLE_INTERVAL_COUNT;

  if (interval === "month" && intervalCount === SINGLE_INTERVAL_COUNT) {
    return "monthly";
  }

  if (
    (interval === "year" && intervalCount === SINGLE_INTERVAL_COUNT) ||
    (interval === "month" && intervalCount === MONTHS_PER_YEAR)
  ) {
    return "yearly";
  }

  throw new AdminTierOverrideError(
    HTTP_BAD_REQUEST,
    `Unsupported Billing cadence for Pricing catalog plan: ${plan.id}`
  );
}

function findProductPlan(
  plans: OverrideCatalogPlan[],
  productId: string
): OverrideCatalogPlan {
  const matches = plans.filter(
    (plan) => plan.id === productId || plan.providerPlanId === productId
  );

  if (matches.length === 0) {
    throw new AdminTierOverrideError(
      HTTP_BAD_REQUEST,
      "No active visible Pricing catalog plan matches the selected product"
    );
  }

  if (matches.length > 1) {
    throw new AdminTierOverrideError(
      HTTP_CONFLICT,
      "Ambiguous Pricing catalog product configuration"
    );
  }

  return matches[0];
}

function resolveOverrideSelection(options: {
  billingPeriod: AdminTierOverrideBillingCadence;
  plans: OverrideCatalogPlan[];
  planId?: string;
  productId?: string;
}): {
  tier: AdminTierOverrideTier;
  billingCadence: AdminTierOverrideBillingCadence | null;
} {
  if (!(options.productId || options.planId)) {
    throw new AdminTierOverrideError(
      HTTP_BAD_REQUEST,
      "Either productId or planId is required"
    );
  }

  const selectedByProduct = options.productId
    ? findProductPlan(options.plans, options.productId)
    : null;
  const tier = selectedByProduct
    ? parseTier(selectedByProduct.canonicalTierId)
    : parseTier(options.planId ?? "");
  let billingCadence: AdminTierOverrideBillingCadence | null;
  if (selectedByProduct) {
    billingCadence = resolvePlanCadence(selectedByProduct);
  } else if (tier === "free") {
    billingCadence = null;
  } else {
    billingCadence = options.billingPeriod;
  }

  if (options.planId && parseTier(options.planId) !== tier) {
    throw new AdminTierOverrideError(
      HTTP_BAD_REQUEST,
      "Selected product does not match the requested Pricing catalog tier"
    );
  }

  if (
    selectedByProduct &&
    billingCadence &&
    billingCadence !== options.billingPeriod
  ) {
    throw new AdminTierOverrideError(
      HTTP_BAD_REQUEST,
      "Selected product does not match the requested Billing cadence"
    );
  }

  const matchingPlans = options.plans.filter((plan) => {
    const planTier = parseTier(plan.canonicalTierId);
    if (planTier !== tier) {
      return false;
    }
    return resolvePlanCadence(plan) === billingCadence;
  });

  if (matchingPlans.length === 0) {
    throw new AdminTierOverrideError(
      HTTP_BAD_REQUEST,
      "No active visible Pricing catalog plan matches the selected tier and Billing cadence"
    );
  }

  if (matchingPlans.length > 1) {
    throw new AdminTierOverrideError(
      HTTP_CONFLICT,
      "Duplicate active visible Pricing catalog plans exist for the selected tier and Billing cadence"
    );
  }

  return { tier, billingCadence };
}

async function resolveTarget(options: {
  organizationId?: string;
  store: AdminTierOverrideStore;
  subscriptionMode: AdminTierOverrideTargetType;
  userId: string;
}): Promise<AdminTierOverrideTarget> {
  if (options.subscriptionMode === "user") {
    return { type: "user", id: options.userId };
  }

  const organizationId = options.organizationId?.trim();
  if (!organizationId) {
    throw new AdminTierOverrideError(
      HTTP_BAD_REQUEST,
      "An organization target is required for Admin tier override"
    );
  }

  if (
    !(await options.store.isOrganizationMember(options.userId, organizationId))
  ) {
    throw new AdminTierOverrideError(
      HTTP_FORBIDDEN,
      "Admin tier override requires membership in the target organization"
    );
  }

  return { type: "organization", id: organizationId };
}

function isSameOverride(
  override: AdminTierOverrideRecord,
  tier: AdminTierOverrideTier,
  billingCadence: AdminTierOverrideBillingCadence | null
): boolean {
  return override.tier === tier && override.billingCadence === billingCadence;
}

function mapOverrideRow(
  row: typeof adminTierOverride.$inferSelect
): AdminTierOverrideRecord {
  return {
    id: row.id,
    targetType: row.targetType as AdminTierOverrideTargetType,
    targetId: row.targetId,
    tier: parseTier(row.tier),
    billingCadence:
      row.billingCadence as AdminTierOverrideBillingCadence | null,
    actorUserId: row.actorUserId,
    sourceAction: row.sourceAction,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const dbAdminTierOverrideStore: AdminTierOverrideStore = {
  async listActiveVisibleCatalogPlans(provider) {
    const rows = await db
      .select({
        id: planTable.id,
        provider: planTable.provider,
        providerPlanId: planTable.providerPlanId,
        canonicalTierId: planTable.canonicalTierId,
        price: planTable.price,
        interval: planTable.interval,
        intervalCount: planTable.intervalCount,
        visible: planTable.visible,
        status: planTable.status,
      })
      .from(planTable)
      .where(
        and(
          eq(planTable.provider, provider),
          eq(planTable.visible, true),
          eq(planTable.status, "active")
        )
      );

    return rows.map((row) => ({
      ...row,
      price: Number(row.price),
      visible: row.visible ?? false,
    }));
  },
  async findOverride(target) {
    const [row] = await db
      .select()
      .from(adminTierOverride)
      .where(
        and(
          eq(adminTierOverride.targetType, target.type),
          eq(adminTierOverride.targetId, target.id)
        )
      )
      .limit(1);

    return row ? mapOverrideRow(row) : null;
  },
  async saveOverride(input) {
    const existing = await this.findOverride(input.target);
    const values = {
      targetType: input.target.type,
      targetId: input.target.id,
      tier: input.tier,
      billingCadence: input.billingCadence,
      actorUserId: input.actorUserId,
      sourceAction: input.sourceAction,
      updatedAt: input.now,
    };

    if (existing) {
      const [updatedRow] = await db
        .update(adminTierOverride)
        .set(values)
        .where(eq(adminTierOverride.id, existing.id))
        .returning();
      return mapOverrideRow(updatedRow);
    }

    const [createdRow] = await db
      .insert(adminTierOverride)
      .values({
        ...values,
        createdAt: input.now,
      })
      .returning();
    return mapOverrideRow(createdRow);
  },
  async deleteOverride(target) {
    const existing = await this.findOverride(target);
    if (!existing) {
      return null;
    }

    await db
      .delete(adminTierOverride)
      .where(eq(adminTierOverride.id, existing.id));
    return existing;
  },
  async createAuditEntry(input) {
    await db.insert(adminTierOverrideAudit).values({
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      tier: input.tier,
      billingCadence: input.billingCadence,
      actorUserId: input.actorUserId,
      sourceAction: input.sourceAction,
      createdAt: input.createdAt,
    });
  },
  async isOrganizationMember(userId, organizationId) {
    const [membership] = await db
      .select({ id: memberTable.id })
      .from(memberTable)
      .where(
        and(
          eq(memberTable.userId, userId),
          eq(memberTable.organizationId, organizationId)
        )
      )
      .limit(1);

    return Boolean(membership);
  },
};

export async function applyAdminTierOverride(
  input: ApplyAdminTierOverrideInput
): Promise<ApplyAdminTierOverrideResult> {
  const store = input.store ?? dbAdminTierOverrideStore;
  if (!isAppAdminActor(input.actor, input.appAdminEmails)) {
    throw new AdminTierOverrideError(
      HTTP_FORBIDDEN,
      "App admin access required"
    );
  }

  const target = await resolveTarget({
    organizationId: input.organizationId,
    store,
    subscriptionMode: input.subscriptionMode,
    userId: input.userId,
  });
  const plans = await store.listActiveVisibleCatalogPlans(input.provider);
  const { tier, billingCadence } = resolveOverrideSelection({
    billingPeriod: input.billingPeriod,
    plans,
    planId: input.planId,
    productId: input.productId,
  });

  const existing = await store.findOverride(target);
  if (existing && isSameOverride(existing, tier, billingCadence)) {
    return {
      kind: "admin-tier-override",
      changed: false,
      override: existing,
      target,
    };
  }

  const now = input.now?.() ?? new Date();
  const override = await store.saveOverride({
    actorUserId: input.actor.id,
    billingCadence,
    now,
    sourceAction: input.sourceAction,
    target,
    tier,
  });

  await store.createAuditEntry({
    action: "apply",
    actorUserId: input.actor.id,
    billingCadence,
    createdAt: now,
    sourceAction: input.sourceAction,
    targetId: target.id,
    targetType: target.type,
    tier,
  });

  return {
    kind: "admin-tier-override",
    changed: true,
    override,
    target,
  };
}

export async function clearAdminTierOverride(input: {
  actor: AdminTierOverrideActor;
  appAdminEmails: string[];
  organizationId?: string;
  sourceAction: string;
  store?: AdminTierOverrideStore;
  subscriptionMode: AdminTierOverrideTargetType;
  userId: string;
  now?: () => Date;
}): Promise<{
  changed: boolean;
  clearedOverride: AdminTierOverrideRecord | null;
}> {
  const store = input.store ?? dbAdminTierOverrideStore;
  if (!isAppAdminActor(input.actor, input.appAdminEmails)) {
    throw new AdminTierOverrideError(
      HTTP_FORBIDDEN,
      "App admin access required"
    );
  }

  const target = await resolveTarget({
    organizationId: input.organizationId,
    store,
    subscriptionMode: input.subscriptionMode,
    userId: input.userId,
  });
  const removed = await store.deleteOverride(target);
  if (!removed) {
    return { changed: false, clearedOverride: null };
  }

  await store.createAuditEntry({
    action: "clear",
    actorUserId: input.actor.id,
    billingCadence: removed.billingCadence,
    createdAt: input.now?.() ?? new Date(),
    sourceAction: input.sourceAction,
    targetId: target.id,
    targetType: target.type,
    tier: removed.tier,
  });

  return { changed: true, clearedOverride: removed };
}

export async function getAdminTierOverrideForMembershipTarget(input: {
  organizationId?: string;
  store?: AdminTierOverrideStore;
  subscriptionMode: AdminTierOverrideTargetType;
  userId: string;
}): Promise<AdminTierOverrideRecord | null> {
  const store = input.store ?? dbAdminTierOverrideStore;
  let target: AdminTierOverrideTarget | null = null;

  if (input.subscriptionMode === "organization" && input.organizationId) {
    target = { type: "organization", id: input.organizationId };
  } else if (input.subscriptionMode === "user") {
    target = { type: "user", id: input.userId };
  }

  return target ? await store.findOverride(target) : null;
}
