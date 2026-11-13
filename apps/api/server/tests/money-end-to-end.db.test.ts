/**
 * Money, end to end (ADR 0007): a price travels from a catalog row through the
 * real Plan change preview and accept routes and the Plan Sync push route, into
 * the real Mercado Pago and Polar adapters, and out to the string the UI shows.
 *
 * Real: Postgres, route handlers, Plan change math, ledger, both adapters and
 * the UI's own `formatPrice`. Faked: the two provider SDK clients (their
 * payloads are what the assertions read), auth, and the HTTP framework.
 *
 * Runs when TEST_DATABASE_URL names a throwaway database whose name ends in
 * `_test` (the schema is dropped and rebuilt from the real migrations);
 * skipped otherwise, except on CI, where it must run.
 */
import { randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import type { PaymentProviderAdapter, Subscription } from "@beztack/payments";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

if (process.env.CI && !TEST_DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL is required on CI for the money end-to-end tests");
}

const MIGRATIONS_FOLDER = resolve(import.meta.dirname, "../../../../packages/db/drizzle");
// The Polar SDK is a dependency of the adapter package, not of this app, so it
// is mocked by the file the adapter really loads (`doMock` runs before the import).
const POLAR_SDK_ENTRY = realpathSync(
  resolve(
    import.meta.dirname,
    "../../../../packages/payments/polar/node_modules/@polar-sh/sdk/dist/2026-10/index.mjs",
  ),
);
const MP_APPLICATION_ID = "123456789";

const mocks = vi.hoisted(() => {
  const mpClient = {
    plans: { get: vi.fn(), update: vi.fn() },
    subscriptions: { create: vi.fn(), get: vi.fn() },
  };
  const polarClient = {
    products: { get: vi.fn(), create: vi.fn(), update: vi.fn() },
    checkouts: { create: vi.fn() },
  };
  return {
    mpClient,
    polarClient,
    provider: { current: null as unknown },
    body: { current: null as unknown },
    env: {
      APP_ADMIN_EMAILS: "",
      DEFAULT_CURRENCY: "UYU",
      MERCADO_PAGO_APPLICATION_ID: "123456789",
      PAYMENT_PROVIDER: "mercadopago",
      SUBSCRIPTION_MODE: "user",
      // Read by the UI's formatPrice, which this test shares with the UI.
      VITE_DEFAULT_CURRENCY: "UYU",
      VITE_DEFAULT_LOCALE: "es-UY",
    },
  };
});

vi.mock("h3", () => ({
  createError(input: { data?: unknown; message?: string; statusCode?: number }) {
    return Object.assign(new Error(input.message ?? "Error"), input);
  },
  defineEventHandler(handler: unknown) {
    return handler;
  },
  readBody: () => Promise.resolve(mocks.body.current),
}));
vi.mock("@/env", () => ({ env: mocks.env }));
vi.mock("@/lib/payments", () => ({
  ensurePaymentProvider: () => Promise.resolve(mocks.provider.current),
}));
vi.mock("@/server/utils/membership", () => ({
  requireAuth: () =>
    Promise.resolve({
      user: { id: "user_1", email: "buyer@example.com" },
      session: {},
    }),
}));
vi.mock("@/server/utils/require-auth", () => ({ requireAdmin: () => Promise.resolve() }));
vi.mock("../../../../packages/payments/mercado-pago/src/server/client.js", () => ({
  createMercadoPagoClient: () => mocks.mpClient,
}));

type Handler = (event: unknown) => Promise<Record<string, unknown>>;

type Modules = {
  db: typeof import("@beztack/db");
  previewRoute: Handler;
  acceptRoute: Handler;
  syncRoute: Handler;
  getCatalogPlans: typeof import("../../lib/payments/catalog-mp").getCatalogPlans;
  buildTierConfig: typeof import("../../../ui/src/contexts/membership/tier-config").buildTierConfigFromPlansAndProducts;
  formatPrice: typeof import("../../../ui/src/lib/format").formatPrice;
  createMercadoPagoAdapter: typeof import("@beztack/mercadopago").createMercadoPagoAdapter;
  createPolarAdapter: typeof import("@beztack/payments-polar").createPolarAdapter;
};

function assertThrowawayDatabase(url: string): void {
  const name = new URL(url).pathname.replace(/^\//, "");
  if (!name.endsWith("_test")) {
    throw new Error(`Refusing to reset "${name}": TEST_DATABASE_URL must name a *_test database`);
  }
}

const DAY_MS = 86_400_000;

/** A Current Subscription 15 days into a 30 day period: half of it is unused. */
function currentSubscription(input: {
  id: string;
  productId: string;
  tier: string;
  integrationId?: string;
  billingAmount?: number;
  billingCurrency?: string;
}): Subscription {
  const now = Date.now();
  return {
    id: input.id,
    status: "active",
    productId: input.productId,
    customerId: "user_1",
    customerEmail: "buyer@example.com",
    currentPeriodStart: new Date(now - 15 * DAY_MS),
    currentPeriodEnd: new Date(now + 15 * DAY_MS),
    metadata: {
      tier: input.tier,
      userId: "user_1",
      billingInterval: "month",
      billingFrequency: 1,
      ...(input.integrationId ? { providerIntegrationId: input.integrationId } : {}),
      ...(input.billingAmount
        ? { billingAmount: input.billingAmount, billingCurrency: input.billingCurrency }
        : {}),
    },
  };
}

describe.skipIf(!TEST_DATABASE_URL)("Money from catalog row to UI string", () => {
  let modules: Modules;

  beforeAll(async () => {
    const url = TEST_DATABASE_URL as string;
    assertThrowawayDatabase(url);
    // @beztack/db opens its client from DATABASE_URL when first imported.
    process.env.DATABASE_URL = url;
    vi.doMock(POLAR_SDK_ENTRY, () => ({
      createPolar: () => mocks.polarClient,
      createPolarCore: vi.fn(),
    }));
    const [
      db,
      preview,
      accept,
      sync,
      catalog,
      tierConfig,
      format,
      mercadopago,
      polar,
      { migrate },
    ] = await Promise.all([
      import("@beztack/db"),
      import("../routes/api/subscriptions/plan-change/preview.post"),
      import("../routes/api/subscriptions/plan-change/accept.post"),
      import("../routes/api/auth/admin/plans/sync.post"),
      import("../../lib/payments/catalog-mp"),
      import("../../../ui/src/contexts/membership/tier-config"),
      import("../../../ui/src/lib/format"),
      import("@beztack/mercadopago"),
      import("@beztack/payments-polar"),
      import("drizzle-orm/postgres-js/migrator"),
    ]);
    modules = {
      db,
      previewRoute: preview.default as Handler,
      acceptRoute: accept.default as Handler,
      syncRoute: sync.default as Handler,
      getCatalogPlans: catalog.getCatalogPlans,
      buildTierConfig: tierConfig.buildTierConfigFromPlansAndProducts,
      formatPrice: format.formatPrice,
      createMercadoPagoAdapter: mercadopago.createMercadoPagoAdapter,
      createPolarAdapter: polar.createPolarAdapter,
    };

    await db.db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
    await db.db.execute(sql`DROP SCHEMA public CASCADE`);
    await db.db.execute(sql`CREATE SCHEMA public`);
    await migrate(db.db, { migrationsFolder: MIGRATIONS_FOLDER });
  });

  afterAll(async () => {
    await modules?.db.db.$client.end();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    const { db, pendingPlanChange, plan, subscription, user } = modules.db;
    await db.delete(pendingPlanChange);
    await db.delete(subscription);
    await db.delete(plan);
    await db.delete(user);
    await db.insert(user).values({ id: "user_1", name: "Buyer", email: "buyer@example.com" });
  });

  async function insertPlan(row: {
    provider: "mercadopago" | "polar";
    tier: "basic" | "pro";
    price: number;
    currency: string;
  }) {
    const { db, plan } = modules.db;
    const id = `plan_${row.provider}_${row.tier}`;
    await db.insert(plan).values({
      id,
      provider: row.provider,
      providerPlanId: `${row.provider}_${row.tier}`,
      canonicalTierId: row.tier,
      displayName: row.tier === "basic" ? "Basic" : "Pro",
      price: row.price,
      currency: row.currency,
      interval: "month",
      intervalCount: 1,
      displayOrder: row.tier === "basic" ? 1 : 2,
    });
    return id;
  }

  async function insertSubscription(id: string, provider: string) {
    await modules.db.db.insert(modules.db.subscription).values({
      id,
      provider,
      status: "active",
      userId: "user_1",
    });
  }

  /** The price the pricing page shows for a tier, built the way the UI builds it. */
  async function pricingPageString(tier: string): Promise<string> {
    const tiers = modules.buildTierConfig([], await modules.getCatalogPlans());
    const config = tiers.find((candidate) => candidate.id === tier);
    return modules.formatPrice(config?.price.monthly ?? 0, config?.currency);
  }

  describe("Mercado Pago in UYU", () => {
    const BASIC = 39_000; // $ 390,00
    const PRO = 79_000; // $ 790,00
    const CREDIT = 19_500; // half of the unused basic period

    function useMercadoPago(subscriptions: Subscription[]) {
      const adapter = modules.createMercadoPagoAdapter({
        accessToken: "access-token",
        applicationId: MP_APPLICATION_ID,
        successUrl: "https://example.com/success",
        currency: "UYU",
      });
      mocks.provider.current = {
        ...adapter,
        listSubscriptions: () => Promise.resolve(subscriptions),
      } satisfies PaymentProviderAdapter;
      mocks.env.PAYMENT_PROVIDER = "mercadopago";
      mocks.env.MERCADO_PAGO_APPLICATION_ID = MP_APPLICATION_ID;
    }

    beforeEach(async () => {
      await insertPlan({ provider: "mercadopago", tier: "basic", price: BASIC, currency: "UYU" });
      await insertPlan({ provider: "mercadopago", tier: "pro", price: PRO, currency: "UYU" });
      await insertSubscription("mp_sub_1", "mercadopago");
      useMercadoPago([
        currentSubscription({
          id: "mp_sub_1",
          productId: "mercadopago_basic",
          tier: "basic",
          integrationId: MP_APPLICATION_ID,
          billingAmount: BASIC,
          billingCurrency: "UYU",
        }),
      ]);
    });

    it("previews the upgrade in minor units and shows the same amount as the pricing page", async () => {
      mocks.body.current = { targetTierId: "pro", targetBillingCadence: "monthly" };

      const { planChangePreview } = (await modules.previewRoute({})) as {
        planChangePreview: {
          direction: string;
          targetPlan: { price: { amount: number; currency: string } };
          firstPayment: { amount: number; credit: number; fullAmount: number; currency: string };
        };
      };

      expect(planChangePreview.direction).toBe("upgrade");
      expect(planChangePreview.targetPlan.price).toEqual({ amount: PRO, currency: "UYU" });
      expect(planChangePreview.firstPayment).toEqual({
        amount: PRO - CREDIT,
        credit: CREDIT,
        fullAmount: PRO,
        currency: "UYU",
      });

      const { price } = planChangePreview.targetPlan;
      expect(modules.formatPrice(price.amount, price.currency)).toBe("$\u00a0790,00");
      await expect(pricingPageString("pro")).resolves.toBe("$\u00a0790,00");
      expect(modules.formatPrice(planChangePreview.firstPayment.amount, "UYU")).toBe(
        "$\u00a0595,00",
      );
    });

    it("accepts the upgrade and sends Mercado Pago the first payment as a decimal, once", async () => {
      mocks.body.current = { targetTierId: "pro", targetBillingCadence: "monthly" };
      mocks.mpClient.subscriptions.create.mockResolvedValue({
        id: "mp_sub_new",
        status: "pending",
        reason: "plan_mercadopago_pro",
        payer_id: 1,
        payer_email: "buyer@example.com",
        init_point: "https://mercadopago.example/checkout/mp_sub_new",
        date_created: "2026-11-01T00:00:00.000Z",
        application_id: MP_APPLICATION_ID,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: 595,
          currency_id: "UYU",
        },
      });

      const { planChangeAcceptance } = (await modules.acceptRoute({})) as {
        planChangeAcceptance: {
          firstPayment: { amount: number; fullAmount: number; currency: string };
        };
      };

      // The route answers in minor units...
      expect(planChangeAcceptance.firstPayment).toMatchObject({
        amount: PRO - CREDIT,
        fullAmount: PRO,
        currency: "UYU",
      });
      // ...and the adapter is the only place that turns them into Mercado Pago decimals.
      const [body] = mocks.mpClient.subscriptions.create.mock.calls[0] as [
        { auto_recurring: { transaction_amount: number; currency_id: string } },
      ];
      expect(body.auto_recurring).toMatchObject({ transaction_amount: 595, currency_id: "UYU" });
    });

    it("stores a downgrade snapshot in minor units and reads the same amount back", async () => {
      useMercadoPago([
        currentSubscription({
          id: "mp_sub_1",
          productId: "mercadopago_pro",
          tier: "pro",
          integrationId: MP_APPLICATION_ID,
          billingAmount: PRO,
          billingCurrency: "UYU",
        }),
      ]);
      mocks.body.current = { targetTierId: "basic", targetBillingCadence: "monthly" };
      mocks.mpClient.plans.get.mockResolvedValue({
        id: "mercadopago_basic",
        status: "active",
        reason: "Basic",
        application_id: MP_APPLICATION_ID,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: 390,
          currency_id: "UYU",
        },
        date_created: "2026-01-01T00:00:00.000Z",
        init_point: "https://mercadopago.example/checkout/basic",
      });

      const { planChangeAcceptance } = (await modules.acceptRoute({})) as {
        planChangeAcceptance: {
          direction: string;
          pendingPlanChange: { targetPlanSnapshot: { price: { amount: number } } };
        };
      };

      expect(planChangeAcceptance.direction).toBe("downgrade");
      expect(planChangeAcceptance.pendingPlanChange.targetPlanSnapshot.price).toEqual({
        amount: BASIC,
        currency: "UYU",
      });
      const [stored] = await modules.db.db.select().from(modules.db.pendingPlanChange);
      expect(stored?.targetPlanSnapshot.price).toEqual({ amount: BASIC, currency: "UYU" });
    });

    it("pushes the catalog price to Mercado Pago as the same amount in decimals", async () => {
      mocks.body.current = { planId: "plan_mercadopago_pro", direction: "push-to-provider" };
      mocks.mpClient.plans.get.mockResolvedValue({
        id: "mercadopago_pro",
        status: "active",
        reason: "Pro",
        application_id: MP_APPLICATION_ID,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: 1,
          currency_id: "UYU",
        },
        date_created: "2026-01-01T00:00:00.000Z",
        init_point: "https://mercadopago.example/checkout/pro",
      });
      mocks.mpClient.plans.update.mockImplementation((_id: string, body: unknown) =>
        Promise.resolve({
          id: "mercadopago_pro",
          status: "active",
          reason: "Pro",
          application_id: MP_APPLICATION_ID,
          auto_recurring: {
            frequency: 1,
            frequency_type: "months",
            currency_id: "UYU",
            ...(body as { auto_recurring: object }).auto_recurring,
          },
          date_created: "2026-01-01T00:00:00.000Z",
          init_point: "https://mercadopago.example/checkout/pro",
        }),
      );

      await modules.syncRoute({});

      const [id, body] = mocks.mpClient.plans.update.mock.calls[0] as [
        string,
        { auto_recurring: { transaction_amount: number } },
      ];
      expect(id).toBe("mercadopago_pro");
      expect(body.auto_recurring.transaction_amount).toBe(790);
    });
  });

  describe("Polar in USD", () => {
    const BASIC = 900; // US$ 9,00
    const PRO = 2900; // US$ 29,00
    const CREDIT = 450;

    function usePolar(subscriptions: Subscription[]) {
      const adapter = modules.createPolarAdapter({
        accessToken: "polar-token",
        server: "sandbox",
        organizationId: "org_1",
        successUrl: "https://example.com/success",
      });
      mocks.provider.current = {
        ...adapter,
        listSubscriptions: () => Promise.resolve(subscriptions),
      } satisfies PaymentProviderAdapter;
      mocks.env.PAYMENT_PROVIDER = "polar";
    }

    function polarProduct(id: string, amount: number) {
      return {
        id,
        name: id,
        is_recurring: true,
        recurring_interval: "month",
        prices: [{ price_amount: amount, price_currency: "usd" }],
      };
    }

    beforeEach(async () => {
      await insertPlan({ provider: "polar", tier: "basic", price: BASIC, currency: "USD" });
      await insertPlan({ provider: "polar", tier: "pro", price: PRO, currency: "USD" });
      await insertSubscription("polar_sub_1", "polar");
    });

    it("previews the upgrade in minor units and shows the same amount as the pricing page", async () => {
      usePolar([
        currentSubscription({ id: "polar_sub_1", productId: "polar_basic", tier: "basic" }),
      ]);
      mocks.body.current = { targetTierId: "pro", targetBillingCadence: "monthly" };

      const { planChangePreview } = (await modules.previewRoute({})) as {
        planChangePreview: {
          direction: string;
          targetPlan: { price: { amount: number; currency: string } };
          firstPayment: { amount: number; credit: number; fullAmount: number; currency: string };
        };
      };

      expect(planChangePreview.direction).toBe("upgrade");
      expect(planChangePreview.firstPayment).toEqual({
        amount: PRO - CREDIT,
        credit: CREDIT,
        fullAmount: PRO,
        currency: "USD",
      });

      const { price } = planChangePreview.targetPlan;
      expect(price).toEqual({ amount: PRO, currency: "USD" });
      expect(modules.formatPrice(price.amount, price.currency)).toBe("US$\u00a029,00");
      await expect(pricingPageString("pro")).resolves.toBe("US$\u00a029,00");
    });

    it("shows a stored Basic downgrade snapshot as US$ 9,00", async () => {
      usePolar([currentSubscription({ id: "polar_sub_1", productId: "polar_pro", tier: "pro" })]);
      mocks.body.current = { targetTierId: "basic", targetBillingCadence: "monthly" };
      mocks.polarClient.products.get.mockResolvedValue(polarProduct("polar_basic", BASIC));

      const { planChangeAcceptance } = (await modules.acceptRoute({})) as {
        planChangeAcceptance: {
          direction: string;
          pendingPlanChange: {
            targetPlanSnapshot: {
              canonicalTierId: string;
              price: { amount: number; currency: string };
            };
          };
        };
      };

      const { targetPlanSnapshot } = planChangeAcceptance.pendingPlanChange;
      expect(planChangeAcceptance.direction).toBe("downgrade");
      expect(targetPlanSnapshot.canonicalTierId).toBe("basic");
      expect(targetPlanSnapshot.price).toEqual({ amount: BASIC, currency: "USD" });
      expect(
        modules.formatPrice(targetPlanSnapshot.price.amount, targetPlanSnapshot.price.currency),
      ).toBe("US$\u00a09,00");
      const [stored] = await modules.db.db.select().from(modules.db.pendingPlanChange);
      expect(stored?.targetPlanSnapshot.price).toEqual({ amount: BASIC, currency: "USD" });
    });

    it("pushes the catalog price to Polar as the same minor units", async () => {
      usePolar([]);
      mocks.body.current = { planId: "plan_polar_pro", direction: "push-to-provider" };
      mocks.polarClient.products.update.mockResolvedValue(polarProduct("polar_pro", PRO));

      await modules.syncRoute({});

      const [id, update] = mocks.polarClient.products.update.mock.calls[0] as [
        string,
        { prices: Array<{ price_amount: number; price_currency: string }> },
      ];
      expect(id).toBe("polar_pro");
      expect(update.prices).toEqual([
        { amount_type: "fixed", price_amount: PRO, price_currency: "usd" },
      ]);
    });

    it("creates a local-only plan at Polar with the catalog price", async () => {
      usePolar([]);
      const localOnlyId = randomUUID();
      await modules.db.db.insert(modules.db.plan).values({
        id: localOnlyId,
        provider: "polar",
        canonicalTierId: "ultimate",
        displayName: "Ultimate",
        price: 9900,
        currency: "USD",
        interval: "month",
        intervalCount: 1,
      });
      mocks.body.current = { planId: localOnlyId, direction: "push-to-provider" };
      mocks.polarClient.products.create.mockResolvedValue(polarProduct("polar_ultimate", 9900));

      await modules.syncRoute({});

      const [create] = mocks.polarClient.products.create.mock.calls[0] as [
        { prices: Array<{ price_amount: number }> },
      ];
      expect(create.prices[0]?.price_amount).toBe(9900);
    });
  });
});
