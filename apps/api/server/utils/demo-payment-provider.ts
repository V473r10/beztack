/**
 * Demo-only Payment provider decorator (docs/demo.md, "What is fake").
 *
 * The public demo seeds a Pro Subscription with a `demo_sub_*` id that does not
 * exist at the real provider (the sandbox cannot create paid Subscriptions by
 * API). This decorator answers for those ids so `/billing` can read the
 * Subscription and a Pending Plan change on it can be activated, and delegates
 * everything else to the real adapter.
 *
 * It exists only when `DEMO_MODE` is exactly `true`: `withDemoSubscriptions`
 * is the sole way to build it, and it hands back the real adapter untouched
 * otherwise, so outside the demo a `demo_sub_*` id goes to the real provider.
 */
import {
  type PaymentProviderAdapter,
  type Subscription,
  SubscriptionUpdateNotAppliedError,
  type UpdateSubscriptionOptions,
} from "@beztack/payments";

/** Id prefix of the Subscriptions the demo seed fabricates. */
export const DEMO_SUBSCRIPTION_PREFIX = "demo_sub_";

export function isDemoSubscriptionId(subscriptionId: string): boolean {
  return subscriptionId.startsWith(DEMO_SUBSCRIPTION_PREFIX);
}

/** Where the fake Subscriptions live (the demo database; in-memory in tests). */
export type DemoSubscriptionStore = {
  get(subscriptionId: string): Promise<Subscription | null>;
  /** Throws `SubscriptionUpdateNotAppliedError` when the product is not in the catalog. */
  switchProduct(subscriptionId: string, productId: string): Promise<Subscription>;
  cancel(subscriptionId: string, immediately: boolean): Promise<Subscription>;
};

export type DemoSubscriptionsOptions = {
  /** The real `DEMO_MODE` flag. Anything but `true` leaves the adapter as it is. */
  demoMode: boolean;
  /** Built lazily, only in demo mode. */
  store: () => DemoSubscriptionStore;
};

function updatesNothingTheDemoSupports(options: UpdateSubscriptionOptions): boolean {
  return !(options.productId || options.cancelAtPeriodEnd === true || options.status === "cancel");
}

export function withDemoSubscriptions(
  adapter: PaymentProviderAdapter,
  options: DemoSubscriptionsOptions,
): PaymentProviderAdapter {
  if (options.demoMode !== true) {
    return adapter;
  }

  const store = options.store();

  return {
    ...adapter,

    async getSubscription(subscriptionId) {
      return isDemoSubscriptionId(subscriptionId)
        ? await store.get(subscriptionId)
        : await adapter.getSubscription(subscriptionId);
    },

    async updateSubscription(subscriptionId, update) {
      if (!isDemoSubscriptionId(subscriptionId)) {
        return await adapter.updateSubscription(subscriptionId, update);
      }
      if (update.productId) {
        return await store.switchProduct(subscriptionId, update.productId);
      }
      if (updatesNothingTheDemoSupports(update)) {
        throw new SubscriptionUpdateNotAppliedError(
          subscriptionId,
          "The demo Subscription only supports a plan change or a cancellation",
        );
      }
      return await store.cancel(subscriptionId, false);
    },

    async cancelSubscription(subscriptionId, ...rest) {
      return isDemoSubscriptionId(subscriptionId)
        ? await store.cancel(subscriptionId, rest[0] === true)
        : await adapter.cancelSubscription(subscriptionId, ...rest);
    },
  };
}
