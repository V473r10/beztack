/**
 * Payment Sync Algorithm
 *
 * Compares local DB plans with remote provider products and produces
 * a unified view showing sync status and field-level diffs.
 */

import type { plan } from "@beztack/db";
import type { Product } from "@beztack/payments";

type DbPlan = typeof plan.$inferSelect;

export type SyncStatus =
  | "synced"
  | "local-only"
  | "remote-only"
  | "out-of-sync";

export type SyncDiff = {
  field: string;
  localValue: unknown;
  remoteValue: unknown;
};

export type SyncDirection = "push-to-provider" | "pull-from-provider";

export type SyncedPlanView = {
  localPlan: DbPlan | null;
  remoteProduct: Product | null;
  syncStatus: SyncStatus;
  diffs: SyncDiff[];
};

/**
 * Compare a single local DB plan against its matched remote product
 * and return an array of field-level diffs.
 */
function computeDiffs(local: DbPlan, remote: Product): SyncDiff[] {
  const diffs: SyncDiff[] = [];

  // displayName (local) vs name (remote)
  if (local.displayName !== remote.name) {
    diffs.push({
      field: "displayName",
      localValue: local.displayName,
      remoteValue: remote.name,
    });
  }

  // description (local) vs description (remote)
  const localDesc = local.description ?? undefined;
  const remoteDesc = remote.description ?? undefined;
  if (localDesc !== remoteDesc) {
    diffs.push({
      field: "description",
      localValue: localDesc,
      remoteValue: remoteDesc,
    });
  }

  // price — local is a numeric string, remote is a number
  const localPrice = Number(local.price);
  const remotePrice = remote.price.amount;
  if (localPrice !== remotePrice) {
    diffs.push({
      field: "price",
      localValue: localPrice,
      remoteValue: remotePrice,
    });
  }

  // currency
  if (local.currency !== remote.price.currency) {
    diffs.push({
      field: "currency",
      localValue: local.currency,
      remoteValue: remote.price.currency,
    });
  }

  // interval
  const localInterval = local.interval ?? undefined;
  const remoteInterval: string | undefined = remote.interval;
  if (localInterval !== remoteInterval) {
    diffs.push({
      field: "interval",
      localValue: localInterval,
      remoteValue: remoteInterval,
    });
  }

  // intervalCount
  const localIntervalCount = local.intervalCount ?? 1;
  const remoteIntervalCount = remote.intervalCount;
  if (localIntervalCount !== remoteIntervalCount) {
    diffs.push({
      field: "intervalCount",
      localValue: localIntervalCount,
      remoteValue: remoteIntervalCount,
    });
  }

  return diffs;
}

/**
 * Build a unified sync view comparing local DB plans with remote provider products.
 *
 * Algorithm:
 * 1. Index DB plans by providerPlanId
 * 2. Index remote products by id
 * 3. For each DB plan, find its matching remote product (via providerPlanId)
 *    and compute diffs to determine sync status
 * 4. Any unmatched remote products are marked as "remote-only"
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Sync view must handle all matching/diffing in one pass
export function buildSyncView(
  dbPlans: DbPlan[],
  remoteProducts: Product[]
): SyncedPlanView[] {
  const results: SyncedPlanView[] = [];
  const matchedRemoteIds = new Set<string>();

  // Index remote products by id for O(1) lookup
  const remoteById = new Map<string, Product>();
  for (const product of remoteProducts) {
    remoteById.set(product.id, product);
  }

  // Process each local DB plan
  for (const dbPlan of dbPlans) {
    if (dbPlan.providerPlanId) {
      const remote = remoteById.get(dbPlan.providerPlanId);

      if (remote) {
        // Matched — compute diffs
        matchedRemoteIds.add(remote.id);
        const diffs = computeDiffs(dbPlan, remote);

        results.push({
          localPlan: dbPlan,
          remoteProduct: remote,
          syncStatus: diffs.length === 0 ? "synced" : "out-of-sync",
          diffs,
        });
      } else {
        // Has providerPlanId but remote product is missing
        results.push({
          localPlan: dbPlan,
          remoteProduct: null,
          syncStatus: "local-only",
          diffs: [],
        });
      }
    } else {
      // No providerPlanId — purely local
      results.push({
        localPlan: dbPlan,
        remoteProduct: null,
        syncStatus: "local-only",
        diffs: [],
      });
    }
  }

  // Add remote products that were not matched by any DB plan
  for (const product of remoteProducts) {
    if (!matchedRemoteIds.has(product.id)) {
      results.push({
        localPlan: null,
        remoteProduct: product,
        syncStatus: "remote-only",
        diffs: [],
      });
    }
  }

  return results;
}
