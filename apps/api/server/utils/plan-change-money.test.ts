/**
 * No amount is converted twice: walks one Upgrade from the Pricing catalog
 * through the Plan change preview, the Mercado Pago adapter, the provider's
 * webhook payment and the projection that follows it (ADR 0007).
 */
import { createMercadoPagoAdapter } from "@beztack/mercadopago";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type PlanChangeCatalogPlan, previewPlanChange } from "./plan-change";
import { createPlanChangePaymentAdapter } from "./plan-change-payment-adapter";

const mocks = vi.hoisted(() => ({
  client: {
    plans: { get: vi.fn() },
    subscriptions: { create: vi.fn(), get: vi.fn(), update: vi.fn() },
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
vi.mock("../../../../packages/payments/mercado-pago/src/server/client", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../../../../packages/payments/mercado-pago/src/server/client")
  >()),
  createMercadoPagoClient: () => mocks.client,
}));

const { createMercadoPagoSubscriptionProjectionProvider } =
  await import("./subscription-projection");

const DAY_MS = 86_400_000;
const PERIOD_END = new Date("2026-07-01T00:00:00.000Z");
const PERIOD_START = new Date(PERIOD_END.getTime() - 30 * DAY_MS);

function plan(overrides: Partial<PlanChangeCatalogPlan>): PlanChangeCatalogPlan {
  return {
    id: "basic",
    paymentProvider: "mercadopago",
    providerPlanId: "mp_basic",
    canonicalTierId: "basic",
    tierRank: 1,
    billingCadence: "monthly",
    price: { amount: 0, currency: "USD" },
    ...overrides,
  };
}

// Catalog prices in minor units; `decimals` is what Mercado Pago must receive.
const CASES = [
  { currency: "USD", basic: 999, pro: 2999, credit: 500, firstPayment: 2499, decimals: 24.99 },
  {
    currency: "UYU",
    basic: 39_000,
    pro: 99_000,
    credit: 19_500,
    firstPayment: 79_500,
    decimals: 795,
  },
  { currency: "JPY", basic: 900, pro: 2900, credit: 450, firstPayment: 2450, decimals: 2450 },
  { currency: "KWD", basic: 9000, pro: 29_000, credit: 4500, firstPayment: 24_500, decimals: 24.5 },
];

describe("catalog -> preview -> adapter -> webhook keeps every amount in minor units", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(CASES)(
    "$currency Upgrade",
    async ({ currency, basic, pro, credit, firstPayment, decimals }) => {
      const basicPlan = plan({ price: { amount: basic, currency } });
      const proPlan = plan({
        id: "pro",
        providerPlanId: "mp_pro",
        canonicalTierId: "pro",
        tierRank: 2,
        price: { amount: pro, currency },
      });
      const store = {
        findCurrentSubscription: () =>
          Promise.resolve({
            id: "sub_current",
            paymentProvider: "mercadopago",
            paymentIntegrationId: "app_1",
            providerPlanId: "mp_basic",
            canonicalTierId: "basic",
            billingCadence: "monthly" as const,
            subscriptionOwnerUserId: "user_1",
            currentPeriodStart: PERIOD_START,
            currentPeriodEnd: PERIOD_END,
            // The adapter reports the charge in minor units: half of `basic` is credited.
            currentPeriodChargedAmount: credit * 2,
          }),
        listActiveVisiblePricingCatalogPlans: () => Promise.resolve([basicPlan, proPlan]),
      };

      // 1. Preview, in minor units.
      const preview = await previewPlanChange({
        actor: {
          userId: "user_1",
          email: "user@example.com",
          isAppAdmin: false,
          isBillingManager: false,
        },
        membershipTarget: { type: "user", id: "user_1" },
        paymentProvider: "mercadopago",
        paymentIntegrationId: "app_1",
        target: { tierId: "pro", billingCadence: "monthly" },
        store: store as never,
        now: () => new Date(PERIOD_END.getTime() - 15 * DAY_MS),
      });
      if (preview.kind !== "plan-change-preview") {
        throw new Error("Expected a priced preview");
      }
      expect(preview.firstPayment).toEqual({
        amount: firstPayment,
        credit,
        currency,
        fullAmount: pro,
      });

      // 2. Adapter: Mercado Pago receives decimals, converted once.
      mocks.client.subscriptions.create.mockResolvedValueOnce({
        id: "sub_new",
        application_id: "app_1",
        init_point: "https://mercadopago.example/sub_new",
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: decimals,
          currency_id: currency,
        },
      });
      const adapter = createPlanChangePaymentAdapter(
        createMercadoPagoAdapter({
          accessToken: "token",
          applicationId: "app_1",
          successUrl: "https://example.com/success",
          currency: "EUR",
        }),
        "app_1",
      );
      await adapter.confirmUpgrade({
        actor: {
          userId: "user_1",
          email: "user@example.com",
          isAppAdmin: false,
          isBillingManager: false,
        },
        currentPlan: preview.currentPlan,
        currentSubscriptionId: preview.currentSubscriptionId,
        firstPayment: preview.firstPayment,
        membershipTarget: preview.membershipTarget,
        targetPlan: preview.targetPlan,
      });
      const [sent] = mocks.client.subscriptions.create.mock.calls[0] ?? [];
      expect(sent.auto_recurring).toMatchObject({
        transaction_amount: decimals,
        currency_id: currency,
      });
      expect(sent.external_reference).toContain(`fullamt=${pro}`);

      // 3. Webhook: the approved payment comes back in decimals and is read once.
      mocks.client.payments.get.mockResolvedValueOnce({
        id: 77,
        status: "approved",
        transaction_amount: decimals,
        currency_id: currency,
        external_reference: sent.external_reference,
      });
      const projection = await createMercadoPagoSubscriptionProjectionProvider();
      const payment = await projection.getPayment("77");
      expect(payment).toMatchObject({ amount: firstPayment, currency });
      expect(payment?.metadata).toMatchObject({ fullAmount: pro });

      // 4. Follow-up: the subscription is raised to the full price, converted once.
      mocks.client.subscriptions.get.mockResolvedValueOnce({
        id: "sub_new",
        application_id: "app_1",
      });
      await projection.adjustSubscriptionAmount(
        "sub_new",
        Number(payment?.metadata?.fullAmount),
        currency,
      );
      const fullDecimals = pro / 10 ** (currency === "JPY" ? 0 : currency === "KWD" ? 3 : 2);
      expect(mocks.client.subscriptions.update).toHaveBeenCalledWith("sub_new", {
        auto_recurring: { transaction_amount: fullDecimals },
      });
    },
  );
});
