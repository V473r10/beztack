/**
 * Seed and reset for the public live demo (docs/demo.md).
 *
 * `seedDemoData` is idempotent: every row has a fixed id and is upserted to its
 * pristine value, so running it again (or after a visitor changed a fixture)
 * restores the demo without duplicating anything. `resetDemoData` wipes every
 * table first, for the periodic reset. Neither reads `@/env`: the caller (the
 * `scripts/seed-demo.ts` CLI, or a test) hands in the database and settings.
 */
import {
  buildSeedPlans,
  type db,
  member,
  organization,
  pendingPlanChange,
  plan,
  type SeedPlan,
  seedPlanId,
  schema,
  subscription,
  user,
} from "@beztack/db";
import { getTableName, sql } from "drizzle-orm";

export type DemoDatabase = typeof db;

export const DEMO_PROVIDERS = ["polar", "mercadopago"] as const;
export type DemoProvider = (typeof DEMO_PROVIDERS)[number];

/** Fixed ids of the demo fixtures. */
export const DEMO_IDS = {
  adminUser: "demo_admin",
  adminAccount: "demo_admin_credential",
  customerUser: "demo_customer",
  customerAccount: "demo_customer_credential",
  organization: "demo_org",
  adminMember: "demo_member_admin",
  customerMember: "demo_member_customer",
  subscription: "demo_sub_pro",
  failedPlanChange: "demo_failed_plan_change",
} as const;

/** `.test` is reserved (RFC 2606): mail to this address can never reach a real inbox. */
export const DEMO_CUSTOMER_EMAIL = "customer@demo.beztack.test";

/** Mirrors `MAX_PENDING_PLAN_CHANGE_ACTIVATION_ATTEMPTS` in `plan-change.ts`. */
const FAILED_ACTIVATION_ATTEMPTS = 5;
const DAY_MS = 24 * 60 * 60 * 1000;
const BILLING_PERIOD_DAYS = 30;

export type DemoSeedOptions = {
  provider: DemoProvider;
  /** Currency of the Mercado Pago plans (Polar always charges in USD). */
  currency: string;
  /** App admin email; must also be on `APP_ADMIN_EMAILS` to open the admin pages. */
  adminEmail: string;
  /** better-auth scrypt hash of the admin password; the password itself never reaches the seed. */
  adminPasswordHash: string;
  /** Same for the seeded customer, so the walkthrough can sign in as them and see the proration. */
  customerPasswordHash: string;
  /** Plan row id -> the provider's product id (Polar product ids, Mercado Pago plan ids). */
  providerPlanIds?: Record<string, string>;
  /** Clock for the billing period and the failure time. */
  now?: Date;
};

export type DemoSeedSummary = {
  plans: number;
  adminEmail: string;
  customerEmail: string;
  organizationId: string;
  failedPlanChangeId: string;
};

function planRow(provider: string, seed: SeedPlan, providerPlanId: string | undefined) {
  return {
    id: seedPlanId(provider, seed),
    provider,
    providerPlanId: providerPlanId ?? null,
    canonicalTierId: seed.canonicalTierId,
    displayName: seed.displayName,
    description: seed.description,
    features: seed.features,
    limits: seed.limits,
    permissions: seed.permissions,
    price: seed.price,
    currency: seed.currency,
    interval: seed.interval,
    displayOrder: seed.displayOrder,
    highlighted: seed.highlighted,
    visible: true,
    status: "active",
  };
}

/** Upserts the demo catalog, organization, App admin and one failed plan change. */
export async function seedDemoData(
  database: DemoDatabase,
  options: DemoSeedOptions,
): Promise<DemoSeedSummary> {
  const now = options.now ?? new Date();
  const periodStart = now;
  const periodEnd = new Date(now.getTime() + BILLING_PERIOD_DAYS * DAY_MS);
  const adminEmail = options.adminEmail.trim().toLowerCase();

  const seedPlans = buildSeedPlans(options.provider, options.currency);
  const planRows = seedPlans.map((seed) =>
    planRow(options.provider, seed, options.providerPlanIds?.[seedPlanId(options.provider, seed)]),
  );
  const proPlanId = seedPlanId(options.provider, { canonicalTierId: "pro", interval: "month" });
  const basicPlan = planRows.find(
    (row) => row.canonicalTierId === "basic" && row.interval === "month",
  );
  const proPlan = planRows.find((row) => row.id === proPlanId);
  if (!(basicPlan && proPlan)) {
    throw new Error("The plan catalog has no basic and pro monthly plans to seed the demo with");
  }

  await database.transaction(async (tx) => {
    for (const row of planRows) {
      await tx.insert(plan).values(row).onConflictDoUpdate({ target: plan.id, set: row });
    }

    const users = [
      {
        id: DEMO_IDS.adminUser,
        name: "Demo Admin",
        email: adminEmail,
        emailVerified: true,
        role: "sudo",
        banned: false,
      },
      {
        id: DEMO_IDS.customerUser,
        name: "Demo Customer",
        email: DEMO_CUSTOMER_EMAIL,
        emailVerified: true,
        role: "user",
        banned: false,
      },
    ];
    for (const row of users) {
      await tx.insert(user).values(row).onConflictDoUpdate({ target: user.id, set: row });
    }

    // better-auth signs in with a `credential` account that holds the hash.
    const credentialAccounts = [
      {
        id: DEMO_IDS.adminAccount,
        accountId: DEMO_IDS.adminUser,
        providerId: "credential",
        userId: DEMO_IDS.adminUser,
        password: options.adminPasswordHash,
      },
      {
        id: DEMO_IDS.customerAccount,
        accountId: DEMO_IDS.customerUser,
        providerId: "credential",
        userId: DEMO_IDS.customerUser,
        password: options.customerPasswordHash,
      },
    ];
    for (const row of credentialAccounts) {
      await tx
        .insert(schema.account)
        .values(row)
        .onConflictDoUpdate({ target: schema.account.id, set: row });
    }

    const org = {
      id: DEMO_IDS.organization,
      name: "Demo Organization",
      slug: "demo-org",
      subscriptionTier: "pro",
      subscriptionStatus: "active",
      subscriptionId: DEMO_IDS.subscription,
      subscriptionValidUntil: periodEnd,
      subscriptionBillingCadence: "monthly",
    };
    await tx
      .insert(organization)
      .values(org)
      .onConflictDoUpdate({ target: organization.id, set: org });

    const members = [
      {
        id: DEMO_IDS.customerMember,
        organizationId: DEMO_IDS.organization,
        userId: DEMO_IDS.customerUser,
        role: "owner",
      },
      {
        id: DEMO_IDS.adminMember,
        organizationId: DEMO_IDS.organization,
        userId: DEMO_IDS.adminUser,
        role: "admin",
      },
    ];
    for (const row of members) {
      await tx.insert(member).values(row).onConflictDoUpdate({ target: member.id, set: row });
    }

    const demoSubscription = {
      id: DEMO_IDS.subscription,
      provider: options.provider,
      providerSubscriptionId: DEMO_IDS.subscription,
      userId: DEMO_IDS.customerUser,
      organizationId: DEMO_IDS.organization,
      planId: proPlan.id,
      status: "active",
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      metadata: {
        tier: "pro",
        planId: "pro",
        billingCadence: "monthly",
        organizationId: DEMO_IDS.organization,
        userId: DEMO_IDS.customerUser,
      },
    };
    await tx
      .insert(subscription)
      .values(demoSubscription)
      .onConflictDoUpdate({ target: subscription.id, set: demoSubscription });

    // A downgrade that failed to activate at renewal: the row the admin
    // "Failed plan changes" page lists, with its Retry action.
    const failedPlanChange = {
      id: DEMO_IDS.failedPlanChange,
      subscriptionId: DEMO_IDS.subscription,
      direction: "downgrade",
      membershipTargetType: "organization",
      membershipTargetId: DEMO_IDS.organization,
      targetPlanSnapshot: {
        id: basicPlan.id,
        paymentProvider: options.provider,
        providerPlanId: basicPlan.providerPlanId,
        canonicalTierId: "basic",
        tierRank: basicPlan.displayOrder,
        billingCadence: "monthly",
        // Minor units, like `plan.price` (ADR 0007): 900 USD is US$ 9.00.
        price: { amount: basicPlan.price, currency: basicPlan.currency },
      },
      providerConfirmedPlanChangeId: basicPlan.providerPlanId ?? basicPlan.id,
      // The renewal it failed to activate at: Retry activates it "now", which
      // the activation only allows once this moment has passed.
      effectiveAt: periodStart,
      status: "failed",
      acceptedByUserId: DEMO_IDS.customerUser,
      canceledByUserId: null,
      reason: "Demo fixture: the payment provider timed out while activating the downgrade",
      retriedByUserId: null,
      retriedAt: null,
      activationAttempts: FAILED_ACTIVATION_ATTEMPTS,
      activatedAt: null,
      canceledAt: null,
      failedAt: now,
    };
    await tx
      .insert(pendingPlanChange)
      .values(failedPlanChange)
      .onConflictDoUpdate({ target: pendingPlanChange.id, set: failedPlanChange });
  });

  return {
    plans: planRows.length,
    adminEmail,
    customerEmail: DEMO_CUSTOMER_EMAIL,
    organizationId: DEMO_IDS.organization,
    failedPlanChangeId: DEMO_IDS.failedPlanChange,
  };
}

/**
 * Empties every table of the schema. Only for the dedicated demo database:
 * `demoMode` must be the real `DEMO_MODE` flag, so a project that is not a demo
 * can never wipe itself by running the wrong script.
 */
export async function resetDemoData(
  database: DemoDatabase,
  guard: { demoMode: boolean },
): Promise<void> {
  if (!guard.demoMode) {
    throw new Error("Refusing to reset the database: DEMO_MODE is not enabled");
  }

  const tables = Object.values(schema).map((table) => `"${getTableName(table)}"`);
  await database.execute(sql.raw(`TRUNCATE TABLE ${tables.join(", ")} RESTART IDENTITY CASCADE`));
}
