import { beforeEach, describe, expect, it, vi } from "vitest";
import { invalidateProductsCache } from "@/server/utils/products-cache";

const mocks = vi.hoisted(() => ({
  ensurePaymentProvider: vi.fn(),
  enrichProductWithCatalog: vi.fn(),
  getCatalogProducts: vi.fn(),
  getCatalogOnlyProducts: vi.fn(),
  env: { PAYMENT_PROVIDER: "mercadopago" },
}));

vi.mock("h3", () => ({
  defineEventHandler(handler: unknown) {
    return handler;
  },
}));
vi.mock("@/env", () => ({ env: mocks.env }));
vi.mock("@/lib/payments", () => ({
  ensurePaymentProvider: mocks.ensurePaymentProvider,
}));
vi.mock("@/lib/payments/catalog-mp", () => ({
  enrichProductWithCatalog: mocks.enrichProductWithCatalog,
  getCatalogProducts: mocks.getCatalogProducts,
  getCatalogOnlyProducts: mocks.getCatalogOnlyProducts,
}));

const CATALOG_PRODUCT = {
  id: "provider_pro_month",
  name: "Pro",
  type: "plan",
  price: { amount: 6000, currency: "UYU" },
  interval: "month",
  intervalCount: 1,
  metadata: { tier: "pro", planId: "pro" },
};

async function loadHandler() {
  return (await import("../routes/api/subscriptions/products.get")).default as (
    event: unknown,
  ) => Promise<unknown>;
}

describe("GET /api/subscriptions/products", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateProductsCache();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.enrichProductWithCatalog.mockImplementation((product: unknown) =>
      Promise.resolve(product),
    );
    mocks.getCatalogProducts.mockResolvedValue([CATALOG_PRODUCT]);
    mocks.getCatalogOnlyProducts.mockResolvedValue([]);
  });

  it("answers from the Payment provider when it is up", async () => {
    const providerProduct = { ...CATALOG_PRODUCT, id: "live_pro_month" };
    mocks.ensurePaymentProvider.mockResolvedValue({
      provider: "mercadopago",
      listProducts: vi.fn().mockResolvedValue([providerProduct]),
    });

    const response = await (await loadHandler())({});

    expect(response).toEqual({ provider: "mercadopago", products: [providerProduct] });
    expect(mocks.getCatalogProducts).not.toHaveBeenCalled();
  });

  it("answers from the Pricing catalog when the Payment provider cannot be reached", async () => {
    mocks.ensurePaymentProvider.mockRejectedValue(new Error("provider not configured"));

    const response = await (await loadHandler())({});

    expect(response).toEqual({
      provider: "mercadopago",
      products: [CATALOG_PRODUCT],
      source: "catalog",
    });
  });

  it("answers from the Pricing catalog when listing provider products fails", async () => {
    mocks.ensurePaymentProvider.mockResolvedValue({
      provider: "mercadopago",
      listProducts: vi.fn().mockRejectedValue(new Error("503 from provider")),
    });

    const response = await (await loadHandler())({});

    expect(response).toMatchObject({ products: [CATALOG_PRODUCT], source: "catalog" });
  });

  describe("plans that exist only in the Pricing catalog", () => {
    const FREE_PRODUCT = {
      id: "polar_free_month",
      name: "Free",
      type: "plan",
      price: { amount: 0, currency: "USD" },
      interval: "month",
      intervalCount: 1,
      metadata: { tier: "free", displayOrder: 0, catalogOnly: true },
    };

    it("adds the Free plan, which has no product at the provider", async () => {
      const providerProduct = { ...CATALOG_PRODUCT, id: "live_pro_month" };
      mocks.ensurePaymentProvider.mockResolvedValue({
        provider: "polar",
        listProducts: vi.fn().mockResolvedValue([providerProduct]),
      });
      mocks.getCatalogOnlyProducts.mockResolvedValue([FREE_PRODUCT]);

      const response = await (await loadHandler())({});

      expect(response).toEqual({ provider: "polar", products: [providerProduct, FREE_PRODUCT] });
      expect(mocks.getCatalogOnlyProducts).toHaveBeenCalledWith("polar");
    });

    it("leaves out a catalog row whose tier the provider already sells", async () => {
      const providerProduct = { ...CATALOG_PRODUCT, id: "live_pro_month" };
      const unsyncedYearly = {
        ...CATALOG_PRODUCT,
        id: "polar_pro_year",
        interval: "year",
        metadata: { tier: "pro", catalogOnly: true },
      };
      mocks.ensurePaymentProvider.mockResolvedValue({
        provider: "polar",
        listProducts: vi.fn().mockResolvedValue([providerProduct]),
      });
      mocks.getCatalogOnlyProducts.mockResolvedValue([unsyncedYearly, FREE_PRODUCT]);

      const response = (await (await loadHandler())({})) as { products: unknown[] };

      expect(response.products).toEqual([providerProduct, FREE_PRODUCT]);
    });

    it("still answers with the provider products when the catalog cannot be read", async () => {
      const providerProduct = { ...CATALOG_PRODUCT, id: "live_pro_month" };
      mocks.ensurePaymentProvider.mockResolvedValue({
        provider: "polar",
        listProducts: vi.fn().mockResolvedValue([providerProduct]),
      });
      mocks.getCatalogOnlyProducts.mockRejectedValue(new Error("relation plan does not exist"));

      const response = await (await loadHandler())({});

      expect(response).toEqual({ provider: "polar", products: [providerProduct] });
    });
  });

  describe("provider calls", () => {
    const PROVIDER_PRODUCT = { ...CATALOG_PRODUCT, id: "live_pro_month" };

    function providerWith(listProducts: ReturnType<typeof vi.fn>) {
      mocks.ensurePaymentProvider.mockResolvedValue({ provider: "polar", listProducts });
    }

    it("asks the provider once for repeated and concurrent requests", async () => {
      const listProducts = vi.fn().mockResolvedValue([PROVIDER_PRODUCT]);
      providerWith(listProducts);
      const handler = await loadHandler();

      await Promise.all([handler({}), handler({}), handler({})]);
      await handler({});

      expect(listProducts).toHaveBeenCalledTimes(1);
    });

    it("asks the provider again after an admin changes the catalog", async () => {
      const listProducts = vi.fn().mockResolvedValue([PROVIDER_PRODUCT]);
      providerWith(listProducts);
      const handler = await loadHandler();

      await handler({});
      invalidateProductsCache();
      await handler({});

      expect(listProducts).toHaveBeenCalledTimes(2);
    });

    it("answers from the Pricing catalog when the provider rate-limits, without asking again right away", async () => {
      const rateLimited = Object.assign(new Error("Status 429 Too Many Requests"), {
        statusCode: 429,
      });
      const listProducts = vi.fn().mockRejectedValue(rateLimited);
      providerWith(listProducts);
      const handler = await loadHandler();

      const first = await handler({});
      const second = await handler({});

      expect(first).toMatchObject({ products: [CATALOG_PRODUCT], source: "catalog" });
      expect(second).toEqual(first);
      expect(listProducts).toHaveBeenCalledTimes(1);
    });
  });
});
