import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  client: {
    subscriptions: { get: vi.fn(), update: vi.fn(), cancel: vi.fn() },
    payments: { get: vi.fn() },
  },
  env: {
    DEFAULT_CURRENCY: "EUR",
    MERCADO_PAGO_ACCESS_TOKEN: "token",
    MERCADO_PAGO_APPLICATION_ID: "app_1",
    MERCADO_PAGO_INTEGRATOR_ID: undefined,
    MERCADO_PAGO_WEBHOOK_SECRET: undefined,
  },
}));

vi.mock("@/env", () => ({ env: mocks.env }));
vi.mock("@beztack/mercadopago/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@beztack/mercadopago/server")>()),
  createMercadoPagoClient: () => mocks.client,
}));

const { createMercadoPagoSubscriptionProjectionProvider } =
  await import("./subscription-projection");

// Mercado Pago decimals on the left, domain minor units on the right (ADR 0007).
const CASES = [
  { currency: "USD", major: 9.99, minor: 999 },
  { currency: "UYU", major: 390, minor: 39_000 },
  { currency: "JPY", major: 900, minor: 900 },
  { currency: "KWD", major: 9.5, minor: 9500 },
];

describe("Mercado Pago subscription projection provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(CASES)(
    "reports a $currency subscription's billing amount in minor units",
    async ({ currency, major, minor }) => {
      mocks.client.subscriptions.get.mockResolvedValueOnce({
        id: "sub_1",
        application_id: "app_1",
        status: "authorized",
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: major,
          currency_id: currency,
        },
      });
      const provider = await createMercadoPagoSubscriptionProjectionProvider();

      const subscription = await provider.getSubscription("sub_1");

      expect(subscription?.metadata).toMatchObject({
        billingAmount: minor,
        billingCurrency: currency,
      });
    },
  );

  it.each(CASES)(
    "reads an approved $currency payment (webhook) in minor units",
    async ({ currency, major, minor }) => {
      mocks.client.payments.get.mockResolvedValueOnce({
        id: 77,
        status: "approved",
        transaction_amount: major,
        currency_id: currency,
      });
      const provider = await createMercadoPagoSubscriptionProjectionProvider();

      await expect(provider.getPayment("77")).resolves.toMatchObject({
        amount: minor,
        currency,
      });
    },
  );

  it.each(CASES)(
    "charges the full $currency amount from the next charge in decimals",
    async ({ currency, major, minor }) => {
      mocks.client.subscriptions.get.mockResolvedValueOnce({
        id: "sub_1",
        application_id: "app_1",
      });
      const provider = await createMercadoPagoSubscriptionProjectionProvider();

      await provider.adjustSubscriptionAmount("sub_1", minor, currency);

      expect(mocks.client.subscriptions.update).toHaveBeenCalledWith("sub_1", {
        auto_recurring: { transaction_amount: major },
      });
    },
  );

  it("refuses a full amount that is not an integer of minor units", async () => {
    mocks.client.subscriptions.get.mockResolvedValueOnce({
      id: "sub_1",
      application_id: "app_1",
    });
    const provider = await createMercadoPagoSubscriptionProjectionProvider();

    await expect(provider.adjustSubscriptionAmount("sub_1", 9.99, "USD")).rejects.toThrow(
      RangeError,
    );
    expect(mocks.client.subscriptions.update).not.toHaveBeenCalled();
  });
});
