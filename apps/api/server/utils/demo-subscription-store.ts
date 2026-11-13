/**
 * The fake provider side of the demo's `demo_sub_*` Subscriptions: the seeded
 * `subscription` row is the state, so a plan change or a cancellation made on
 * it shows in the next read of `/billing` without any provider involved.
 *
 * The charged amount comes from the plan row the Subscription points at, in
 * integer minor units like the rest of the catalog (ADR 0007).
 */
import { db, plan, subscription, user } from "@beztack/db";
import {
  type Subscription,
  type SubscriptionStatus,
  SubscriptionUpdateNotAppliedError,
} from "@beztack/payments";
import { and, eq, or } from "drizzle-orm";
import type { DemoSubscriptionStore } from "./demo-payment-provider";

type DemoDatabase = typeof db;

const SUBSCRIPTION_STATUSES: readonly string[] = [
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "pending",
  "inactive",
  "canceled",
  "paused",
] satisfies SubscriptionStatus[];

function toStatus(status: string): SubscriptionStatus {
  return SUBSCRIPTION_STATUSES.includes(status) ? (status as SubscriptionStatus) : "inactive";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createDbDemoSubscriptionStore(database: DemoDatabase = db): DemoSubscriptionStore {
  async function get(subscriptionId: string): Promise<Subscription | null> {
    const [row] = await database
      .select({
        subscription,
        plan,
        customerEmail: user.email,
      })
      .from(subscription)
      .leftJoin(plan, eq(plan.id, subscription.planId))
      .leftJoin(user, eq(user.id, subscription.userId))
      .where(eq(subscription.id, subscriptionId));
    if (!(row?.plan && row.subscription.userId)) {
      return null;
    }

    const { subscription: sub, plan: planRow } = row;
    return {
      id: sub.id,
      status: toStatus(sub.status),
      productId: planRow.providerPlanId ?? planRow.id,
      productName: planRow.displayName,
      customerId: sub.userId as string,
      customerEmail: row.customerEmail ?? undefined,
      currentPeriodStart: sub.currentPeriodStart ?? undefined,
      currentPeriodEnd: sub.currentPeriodEnd ?? undefined,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd ?? false,
      metadata: {
        ...(isRecord(sub.metadata) ? sub.metadata : {}),
        billingAmount: planRow.price,
        billingCurrency: planRow.currency,
        billingInterval: planRow.interval ?? "month",
      },
    };
  }

  async function getOrThrow(subscriptionId: string): Promise<Subscription> {
    const found = await get(subscriptionId);
    if (!found) {
      throw new Error(`Demo Subscription ${subscriptionId} does not exist`);
    }
    return found;
  }

  return {
    get,

    async switchProduct(subscriptionId, productId) {
      const [current] = await database
        .select()
        .from(subscription)
        .where(eq(subscription.id, subscriptionId));
      if (!current) {
        throw new Error(`Demo Subscription ${subscriptionId} does not exist`);
      }

      const [target] = await database
        .select()
        .from(plan)
        .where(
          and(
            eq(plan.provider, current.provider),
            or(eq(plan.providerPlanId, productId), eq(plan.id, productId)),
          ),
        );
      if (!target) {
        throw new SubscriptionUpdateNotAppliedError(
          subscriptionId,
          `Product ${productId} is not in the demo catalog`,
        );
      }

      await database
        .update(subscription)
        .set({
          planId: target.id,
          metadata: {
            ...(isRecord(current.metadata) ? current.metadata : {}),
            tier: target.canonicalTierId,
            planId: target.canonicalTierId,
            billingCadence: target.interval === "year" ? "yearly" : "monthly",
          },
        })
        .where(eq(subscription.id, subscriptionId));

      return await getOrThrow(subscriptionId);
    },

    async cancel(subscriptionId, immediately) {
      await getOrThrow(subscriptionId);
      await database
        .update(subscription)
        .set(immediately ? { status: "canceled" } : { cancelAtPeriodEnd: true })
        .where(eq(subscription.id, subscriptionId));

      return await getOrThrow(subscriptionId);
    },
  };
}
