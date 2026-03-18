import { db, subscription as subscriptionTable } from "@beztack/db";
import { and, eq } from "drizzle-orm";
import type {
  PaymentProviderAdapter,
  Subscription,
} from "@/lib/payments/types";

/**
 * DB-assisted subscription discovery with provider verification.
 * Uses local subscription table to find subscription IDs for a user,
 * then verifies each against the provider API for fresh status.
 */
export async function discoverSubscriptionsFromDb(
  userId: string,
  provider: PaymentProviderAdapter
): Promise<Subscription[]> {
  const dbSubs = await db
    .select({
      id: subscriptionTable.id,
      providerSubscriptionId: subscriptionTable.providerSubscriptionId,
      metadata: subscriptionTable.metadata,
    })
    .from(subscriptionTable)
    .where(
      and(
        eq(subscriptionTable.userId, userId),
        eq(subscriptionTable.provider, provider.provider)
      )
    );

  const results: Subscription[] = [];

  for (const dbSub of dbSubs) {
    const subId = dbSub.providerSubscriptionId ?? dbSub.id;
    const fresh = await provider.getSubscription(subId);
    if (fresh) {
      const dbTier = (dbSub.metadata as Record<string, unknown>)?.tier;
      if (!fresh.metadata?.tier && typeof dbTier === "string") {
        fresh.metadata = { ...fresh.metadata, tier: dbTier };
      }
      results.push(fresh);
    }
  }

  return results;
}
