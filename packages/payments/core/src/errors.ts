/**
 * The Payment provider accepted a Subscription update but did not apply it.
 *
 * Some providers answer a successful status while silently ignoring a change
 * (Mercado Pago ignores a new frequency or plan on an existing preapproval).
 * Adapters verify what came back and throw this instead of returning the
 * unchanged Subscription, so callers never record terms the provider will not
 * charge. Retrying does not help: the same request is ignored again.
 */
export class SubscriptionUpdateNotAppliedError extends Error {
  readonly subscriptionId: string;

  constructor(subscriptionId: string, message: string) {
    super(message);
    this.name = "SubscriptionUpdateNotAppliedError";
    this.subscriptionId = subscriptionId;
  }
}

export function isSubscriptionUpdateNotAppliedError(
  error: unknown,
): error is SubscriptionUpdateNotAppliedError {
  // Checked by name too: the API and an adapter can load separate copies of
  // this package (built dist vs source), which defeats `instanceof`.
  return (
    error instanceof SubscriptionUpdateNotAppliedError ||
    (error instanceof Error && error.name === "SubscriptionUpdateNotAppliedError")
  );
}
