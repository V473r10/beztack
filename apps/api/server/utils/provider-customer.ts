import type { PaymentProviderAdapter } from "@beztack/payments";
import { createError } from "h3";

type CheckoutUser = {
  id: string;
  email: string;
  name?: string | null;
};

const CONFLICT = 409;
const CLIENT_ERROR_MIN = 400;
const CLIENT_ERROR_MAX = 499;
const EMAIL_IN_TEXT = /[^\s@"'<>]+@[^\s@"'<>]+/g;

function statusOf(error: unknown): number | undefined {
  if (error && typeof error === "object" && "statusCode" in error) {
    const { statusCode } = error as { statusCode?: unknown };
    return typeof statusCode === "number" ? statusCode : undefined;
  }
  return;
}

/**
 * Makes sure the payment provider has a customer for this user before a
 * checkout. Sign-up creates the customer best effort, so it can be missing
 * (provider was down, or rejected the email). Only Polar needs this: Mercado
 * Pago creates its payer inside the checkout and keeps its behavior.
 *
 * - Customer found, or creation hits a CONFLICT (it already exists): reuse.
 * The lookup and the creation share the error mapping below, so a failing lookup is never a raw 500.
 * - Provider rejects the email (4xx): 422 `customer_email_rejected`.
 * - Provider unreachable or failing (network, 5xx): 502 `payment_provider_unavailable`.
 */
export async function ensureProviderCustomer(
  provider: PaymentProviderAdapter,
  user: CheckoutUser,
): Promise<void> {
  if (provider.provider !== "polar") {
    return;
  }

  try {
    const existing = await provider.getCustomerByEmail(user.email);
    if (existing) {
      return;
    }

    await provider.createCustomer(
      user.email,
      { source: "beztack-checkout", userId: user.id },
      { externalId: user.id, name: user.name ?? undefined },
    );
  } catch (error) {
    const status = statusOf(error);
    if (status === CONFLICT) {
      return;
    }

    // Provider errors echo the rejected email back; keep it out of the logs.
    const detail = (error instanceof Error ? error.message : String(error)).replace(
      EMAIL_IN_TEXT,
      "[email]",
    );
    // biome-ignore lint/suspicious/noConsole: provider failure visible in server logs
    console.warn(
      `[checkout] ${provider.provider} customer lookup or creation failed for user ${user.id} (status ${status ?? "none"}): ${detail}`,
    );

    if (status !== undefined && status >= CLIENT_ERROR_MIN && status <= CLIENT_ERROR_MAX) {
      throw createError({
        statusCode: 422,
        statusMessage: "The payment provider rejected this email address. Use a different email.",
        data: { code: "customer_email_rejected" },
      });
    }

    throw createError({
      statusCode: 502,
      statusMessage: "The payment provider is unavailable. Try again in a moment.",
      data: { code: "payment_provider_unavailable" },
    });
  }
}
