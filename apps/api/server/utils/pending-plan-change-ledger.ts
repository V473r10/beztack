/**
 * Drizzle-backed Pending Plan change ledger.
 *
 * The one place that reads and writes `pending_plan_change`. Rows are never
 * deleted: cancellation, replacement, activation and failure move `status`
 * and record who, when and why. The partial unique index keeps at most one
 * `pending` row per Subscription.
 */
import { randomUUID } from "node:crypto";
import {
  db,
  organization as organizationTable,
  pendingPlanChange as pendingPlanChangeTable,
  user as userTable,
} from "@beztack/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type {
  PendingPlanChangeRecord,
  PendingPlanChangeStatus,
  PlanChangeBillingCadence,
  PlanChangeCatalogPlan,
  PlanChangeMembershipTarget,
  PlanChangeProjectionStore,
  PlanChangeStore,
  PendingPlanChangeRetryStore,
} from "@/server/utils/plan-change";

export type PendingPlanChangeLedger = Pick<
  PendingPlanChangeRetryStore,
  "requeueFailedPendingPlanChange"
> &
  Pick<
    PlanChangeStore,
    | "cancelPendingPlanChange"
    | "findPendingPlanChange"
    | "markPendingPlanChangeActivated"
    | "recordPendingPlanChangeActivationFailure"
    | "savePendingPlanChange"
  > &
  Pick<PlanChangeProjectionStore, "findLatestActivatedPlanChange">;

type PendingPlanChangeRow = typeof pendingPlanChangeTable.$inferSelect;

const PENDING_STATUSES = new Set<string>(["pending", "activated", "canceled", "failed"]);

function isPlanChangeBillingCadence(value: string): value is PlanChangeBillingCadence {
  return value === "monthly" || value === "yearly";
}

function mapDirection(direction: string): PendingPlanChangeRecord["direction"] {
  if (direction === "downgrade" || direction === "cadence_change") {
    return direction;
  }

  throw new Error("Stored Pending Plan change has an invalid direction");
}

function mapStatus(status: string): PendingPlanChangeStatus {
  if (PENDING_STATUSES.has(status)) {
    return status as PendingPlanChangeStatus;
  }

  throw new Error("Stored Pending Plan change has an invalid status");
}

function mapMembershipTarget(row: PendingPlanChangeRow): PlanChangeMembershipTarget {
  if (row.membershipTargetType === "user" || row.membershipTargetType === "organization") {
    return { type: row.membershipTargetType, id: row.membershipTargetId };
  }

  throw new Error("Stored Pending Plan change has an invalid Membership target");
}

function mapTargetPlanSnapshot(
  snapshot: PendingPlanChangeRow["targetPlanSnapshot"],
): PlanChangeCatalogPlan {
  if (!isPlanChangeBillingCadence(snapshot.billingCadence)) {
    throw new Error("Stored Pending Plan change target Plan has an invalid Billing cadence");
  }

  return { ...snapshot, billingCadence: snapshot.billingCadence };
}

export function mapPendingPlanChangeRow(row: PendingPlanChangeRow): PendingPlanChangeRecord {
  return {
    acceptedByUserId: row.acceptedByUserId,
    activationAttempts: row.activationAttempts,
    canceledByUserId: row.canceledByUserId,
    direction: mapDirection(row.direction),
    effectiveAt: row.effectiveAt,
    id: row.id,
    membershipTarget: mapMembershipTarget(row),
    providerConfirmedPlanChangeId: row.providerConfirmedPlanChangeId,
    reason: row.reason,
    status: mapStatus(row.status),
    subscriptionId: row.subscriptionId,
    targetPlanSnapshot: mapTargetPlanSnapshot(row.targetPlanSnapshot),
  };
}

function isPendingFor(subscriptionId: string) {
  return and(
    eq(pendingPlanChangeTable.subscriptionId, subscriptionId),
    eq(pendingPlanChangeTable.status, "pending"),
  );
}

export function createDbPendingPlanChangeLedger(): PendingPlanChangeLedger {
  return {
    async cancelPendingPlanChange(subscriptionId, cancellation) {
      const [row] = await db
        .update(pendingPlanChangeTable)
        .set({
          canceledAt: new Date(),
          canceledByUserId: cancellation.canceledByUserId,
          reason: cancellation.reason,
          status: "canceled",
        })
        .where(isPendingFor(subscriptionId))
        .returning();

      return row ? mapPendingPlanChangeRow(row) : null;
    },
    async findPendingPlanChange(subscriptionId) {
      const [row] = await db
        .select()
        .from(pendingPlanChangeTable)
        .where(isPendingFor(subscriptionId))
        .limit(1);

      return row ? mapPendingPlanChangeRow(row) : null;
    },
    async findLatestActivatedPlanChange(subscriptionId) {
      const [row] = await db
        .select()
        .from(pendingPlanChangeTable)
        .where(
          and(
            eq(pendingPlanChangeTable.subscriptionId, subscriptionId),
            eq(pendingPlanChangeTable.status, "activated"),
          ),
        )
        .orderBy(desc(pendingPlanChangeTable.activatedAt))
        .limit(1);

      return row ? mapPendingPlanChangeRow(row) : null;
    },
    async markPendingPlanChangeActivated(subscriptionId) {
      const [row] = await db
        .update(pendingPlanChangeTable)
        .set({ activatedAt: new Date(), status: "activated" })
        .where(isPendingFor(subscriptionId))
        .returning();

      return row ? mapPendingPlanChangeRow(row) : null;
    },
    async recordPendingPlanChangeActivationFailure(subscriptionId, failure) {
      // One statement, so concurrent deliveries cannot lose a count.
      const reachesLimit = sql`${pendingPlanChangeTable.activationAttempts} + 1 >= ${failure.maxAttempts}`;
      const [row] = await db
        .update(pendingPlanChangeTable)
        .set({
          activationAttempts: sql`${pendingPlanChangeTable.activationAttempts} + 1`,
          failedAt: sql`CASE WHEN ${reachesLimit} THEN now() ELSE NULL END`,
          reason: failure.error,
          status: sql`CASE WHEN ${reachesLimit} THEN 'failed' ELSE 'pending' END`,
        })
        .where(isPendingFor(subscriptionId))
        .returning();

      return row ? mapPendingPlanChangeRow(row) : null;
    },
    async requeueFailedPendingPlanChange(pendingPlanChangeId) {
      // One statement: the NOT EXISTS and the partial unique index together
      // keep a concurrent retry or a newer request from making two `pending`.
      const newerPending = alias(pendingPlanChangeTable, "newer_pending");
      const [row] = await db
        .update(pendingPlanChangeTable)
        .set({ status: "pending" })
        .where(
          and(
            eq(pendingPlanChangeTable.id, pendingPlanChangeId),
            eq(pendingPlanChangeTable.status, "failed"),
            sql`NOT EXISTS (${db
              .select({ id: newerPending.id })
              .from(newerPending)
              .where(
                and(
                  eq(newerPending.subscriptionId, pendingPlanChangeTable.subscriptionId),
                  eq(newerPending.status, "pending"),
                ),
              )})`,
          ),
        )
        .returning();

      return row ? mapPendingPlanChangeRow(row) : null;
    },
    async savePendingPlanChange(input) {
      const row = await db.transaction(async (tx) => {
        await tx
          .update(pendingPlanChangeTable)
          .set({
            canceledAt: new Date(),
            canceledByUserId: null,
            reason: "replaced",
            status: "canceled",
          })
          .where(isPendingFor(input.subscriptionId));

        const [inserted] = await tx
          .insert(pendingPlanChangeTable)
          .values({
            acceptedByUserId: input.acceptedByUserId,
            direction: input.direction,
            effectiveAt: input.effectiveAt,
            id: randomUUID(),
            membershipTargetId: input.membershipTarget.id,
            membershipTargetType: input.membershipTarget.type,
            providerConfirmedPlanChangeId: input.providerConfirmedPlanChangeId,
            status: "pending",
            subscriptionId: input.subscriptionId,
            targetPlanSnapshot: input.targetPlanSnapshot,
          })
          .returning();

        return inserted;
      });

      return mapPendingPlanChangeRow(row);
    },
  };
}

/** The Membership target's `pending` change, newest first if several Subscriptions have one. */
export async function findPendingPlanChangeForMembershipTarget(
  target: PlanChangeMembershipTarget,
): Promise<PendingPlanChangeRecord | null> {
  const [row] = await db
    .select()
    .from(pendingPlanChangeTable)
    .where(
      and(
        eq(pendingPlanChangeTable.membershipTargetType, target.type),
        eq(pendingPlanChangeTable.membershipTargetId, target.id),
        eq(pendingPlanChangeTable.status, "pending"),
      ),
    )
    .orderBy(desc(pendingPlanChangeTable.createdAt))
    .limit(1);

  return row ? mapPendingPlanChangeRow(row) : null;
}

export type FailedPendingPlanChange = PendingPlanChangeRecord & {
  createdAt: Date;
  failedAt: Date | null;
  /** The user's email or the organization's name; null if it was deleted. */
  membershipTargetName: string | null;
  /** Null when reconciled from provider evidence or the user was deleted. */
  acceptedByEmail: string | null;
};

/** Every `failed` change, newest first, for App admins to resolve. */
export async function listFailedPendingPlanChanges(): Promise<FailedPendingPlanChange[]> {
  // Aliased here, not at module load, so routes that mock `@beztack/db`
  // without `user` can still import this module.
  const targetUserTable = alias(userTable, "target_user");
  const acceptedByUserTable = alias(userTable, "accepted_by_user");
  const rows = await db
    .select({
      change: pendingPlanChangeTable,
      targetUserEmail: targetUserTable.email,
      targetOrganizationName: organizationTable.name,
      acceptedByEmail: acceptedByUserTable.email,
    })
    .from(pendingPlanChangeTable)
    .leftJoin(
      targetUserTable,
      and(
        eq(pendingPlanChangeTable.membershipTargetType, "user"),
        eq(targetUserTable.id, pendingPlanChangeTable.membershipTargetId),
      ),
    )
    .leftJoin(
      organizationTable,
      and(
        eq(pendingPlanChangeTable.membershipTargetType, "organization"),
        eq(organizationTable.id, pendingPlanChangeTable.membershipTargetId),
      ),
    )
    .leftJoin(
      acceptedByUserTable,
      eq(acceptedByUserTable.id, pendingPlanChangeTable.acceptedByUserId),
    )
    .where(eq(pendingPlanChangeTable.status, "failed"))
    .orderBy(desc(pendingPlanChangeTable.failedAt));

  return rows.map(({ change, targetUserEmail, targetOrganizationName, acceptedByEmail }) => ({
    ...mapPendingPlanChangeRow(change),
    createdAt: change.createdAt,
    failedAt: change.failedAt,
    membershipTargetName: targetUserEmail ?? targetOrganizationName ?? null,
    acceptedByEmail: acceptedByEmail ?? null,
  }));
}
