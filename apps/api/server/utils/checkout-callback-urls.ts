type ResolveCheckoutCallbackUrlsInput = {
  configuredSuccessUrl: string;
  configuredCancelUrl: string;
  requestSuccessUrl?: string;
  requestCancelUrl?: string;
};

type CheckoutCallbackUrls = {
  successUrl: string;
  cancelUrl: string;
};

export function resolveCheckoutCallbackUrls({
  configuredSuccessUrl,
  configuredCancelUrl,
}: ResolveCheckoutCallbackUrlsInput): CheckoutCallbackUrls {
  return {
    successUrl: configuredSuccessUrl,
    cancelUrl: configuredCancelUrl,
  };
}
