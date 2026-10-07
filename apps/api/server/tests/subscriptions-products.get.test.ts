import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensurePaymentProvider: vi.fn(),
  enrichProductWithCatalog: vi.fn(),
  getCatalogProducts: vi.fn(),
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
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.enrichProductWithCatalog.mockImplementation((product: unknown) =>
      Promise.resolve(product),
    );
    mocks.getCatalogProducts.mockResolvedValue([CATALOG_PRODUCT]);
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
});
