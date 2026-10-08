/**
 * Drizzle-backed Pending Plan change ledger.
 *
 * The one place that reads and writes `pending_plan_change`. Rows are never
 * deleted: cancellation, replacement, activation and failure move `status`
 * and record who, when and why. The partial unique index keeps at most one
 * `pending` row per Subscription.
 */
import { randomUUID } from "node:crypto";
import { db, pendingPlanChange as pendingPlanChangeTable } from "@beztack/db";
import { and, desc, eq, sql } from "drizzle-orm";
import type {
  PendingPlanChangeRecord,
  PendingPlanChangeStatus,
  PlanChangeBillingCadence,
  PlanChangeCatalogPlan,
  PlanChangeMembershipTarget,
  PlanChangeProjectionStore,
  PlanChangeStore,
} from "@/server/utils/plan-change";

export type PendingPlanChangeLedger = Pick<
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
};

/** Every `failed` change, newest first, for App admins to resolve. */
export async function listFailedPendingPlanChanges(): Promise<FailedPendingPlanChange[]> {
  const rows = await db
    .select()
    .from(pendingPlanChangeTable)
    .where(eq(pendingPlanChangeTable.status, "failed"))
    .orderBy(desc(pendingPlanChangeTable.failedAt));

  return rows.map((row) => ({
    ...mapPendingPlanChangeRow(row),
    createdAt: row.createdAt,
    failedAt: row.failedAt,
  }));
}
