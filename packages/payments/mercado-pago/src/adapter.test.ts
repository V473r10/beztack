import type { Product, Subscription } from "@beztack/payments";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMercadoPagoAdapter } from "./adapter.js";
import { createMercadoPagoClient } from "./server/client.js";
import type { MPPreapproval, MPPreapprovalPlan } from "./types.js";

vi.mock("./server/client.js", () => ({
  createMercadoPagoClient: vi.fn(),
}));

const APPLICATION_ID = "123456789";
const OTHER_APPLICATION_ID = "987654321";

type MercadoPagoClientDouble = {
  plans: {
    list: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    deactivate: ReturnType<typeof vi.fn>;
  };
  subscriptions: {
    search: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
  };
  customers: {
    create: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    searchByEmail: ReturnType<typeof vi.fn>;
  };
};

function createClientDouble(): MercadoPagoClientDouble {
  return {
    plans: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deactivate: vi.fn(),
    },
    subscriptions: {
      search: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      cancel: vi.fn(),
    },
    customers: {
      create: vi.fn(),
      get: vi.fn(),
      searchByEmail: vi.fn(),
    },
  };
}

function createAdapter() {
  return createMercadoPagoAdapter({
    accessToken: "access-token",
    applicationId: APPLICATION_ID,
    successUrl: "https://example.com/success",
  });
}

function plan(
  id: string,
  applicationId: string | number | null = APPLICATION_ID
): MPPreapprovalPlan {
  const result: MPPreapprovalPlan = {
    id,
    status: "active",
    reason: `Plan ${id}`,
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: 1000,
      currency_id: "UYU",
    },
    date_created: "2026-01-01T00:00:00.000Z",
    init_point: `https://mercadopago.example/checkout/${id}`,
  };

  if (applicationId !== null) {
    result.application_id = applicationId;
  }

  return result;
}

function subscription(
  id: string,
  applicationId: string | number | null = APPLICATION_ID
): MPPreapproval {
  const result: MPPreapproval = {
    id,
    status: "authorized",
    reason: `Subscription ${id}`,
    payer_id: 123,
    payer_email: "payer@example.com",
    init_point: `https://mercadopago.example/subscription/${id}`,
    date_created: "2026-01-01T00:00:00.000Z",
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: 1000,
      currency_id: "UYU",
    },
    preapproval_plan_id: "plan_match",
  };

  if (applicationId !== null) {
    result.application_id = applicationId;
  }

  return result;
}

describe("createMercadoPagoAdapter", () => {
  let client: MercadoPagoClientDouble;

  beforeEach(() => {
    client = createClientDouble();
    vi.mocked(createMercadoPagoClient).mockReturnValue(client as never);
  });

  it("requires the Mercado Pago Application ID", () => {
    expect(() =>
      createMercadoPagoAdapter({
        accessToken: "access-token",
        successUrl: "https://example.com/success",
      })
    ).toThrow("MERCADO_PAGO_APPLICATION_ID");
  });

  it("returns only plans from the configured Application and scans later pages", async () => {
    client.plans.list
      .mockResolvedValueOnce({
        paging: { total: 2, limit: 1, offset: 0 },
        results: [plan("plan_other", OTHER_APPLICATION_ID)],
      })
      .mockResolvedValueOnce({
        paging: { total: 2, limit: 1, offset: 1 },
        results: [plan("plan_match", APPLICATION_ID)],
      });

    const products = await createAdapter().listProducts();

    expect(products.map((product: Product) => product.id)).toEqual([
      "plan_match",
    ]);
    expect(client.plans.list).toHaveBeenCalledTimes(2);
  });

  it("treats cross-Application plan reads as not found", async () => {
    client.plans.get.mockResolvedValueOnce(
      plan("plan_other", OTHER_APPLICATION_ID)
    );

    await expect(createAdapter().getProduct("plan_other")).resolves.toBeNull();
  });

  it("blocks cross-Application plan mutations", async () => {
    client.plans.get.mockResolvedValueOnce(
      plan("plan_other", OTHER_APPLICATION_ID)
    );

    await expect(
      createAdapter().updateProduct("plan_other", { name: "New name" })
    ).rejects.toThrow("Product not found");
    expect(client.plans.update).not.toHaveBeenCalled();
  });

  it("verifies newly created plans belong to the configured Application", async () => {
    client.plans.create.mockResolvedValueOnce(
      plan("plan_other", OTHER_APPLICATION_ID)
    );

    await expect(
      createAdapter().createProduct({
        name: "Pro",
        type: "plan",
        price: { amount: 1000, currency: "UYU" },
        interval: "month",
        intervalCount: 1,
      })
    ).rejects.toThrow("configured Mercado Pago Application");
  });

  it("returns only subscriptions from the configured Application and scans later pages", async () => {
    client.subscriptions.search
      .mockResolvedValueOnce({
        paging: { total: 2, limit: 1, offset: 0 },
        results: [subscription("sub_other", OTHER_APPLICATION_ID)],
      })
      .mockResolvedValueOnce({
        paging: { total: 2, limit: 1, offset: 1 },
        results: [subscription("sub_match", APPLICATION_ID)],
      });

    const subscriptions = await createAdapter().listSubscriptions({
      customerEmail: "payer@example.com",
      limit: 1,
    });

    expect(subscriptions.map((item: Subscription) => item.id)).toEqual([
      "sub_match",
    ]);
    expect(client.subscriptions.search).toHaveBeenCalledTimes(2);
  });

  it("creates metadata-carrying redirect checkout without requiring a card token", async () => {
    client.plans.get.mockResolvedValueOnce(plan("plan_match"));
    client.subscriptions.create.mockResolvedValueOnce({
      ...subscription("sub_created"),
      external_reference: "beztack_uid=user_1&tier=pro&tplan=plan_match",
      init_point: "https://mercadopago.example/subscription/sub_created",
    });

    const checkout = await createAdapter().createCheckout({
      productId: "plan_match",
      customerEmail: "payer@example.com",
      customerId: "user_1",
      successUrl: "https://example.com/success",
      metadata: {
        targetPlanId: "plan_other",
        tier: "pro",
        userId: "user_1",
      },
    });

    expect(client.subscriptions.create).toHaveBeenCalledWith(
      expect.not.objectContaining({
        card_token_id: expect.any(String),
        preapproval_plan_id: expect.any(String),
      })
    );
    expect(client.subscriptions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        auto_recurring: {
          currency_id: "UYU",
          frequency: 1,
          frequency_type: "months",
          transaction_amount: 1000,
        },
        external_reference: "beztack_uid=user_1&tier=pro&tplan=plan_match",
        payer_email: "payer@example.com",
        reason: "Plan plan_match",
      })
    );
    expect(checkout).toEqual({
      id: "sub_created",
      url: "https://mercadopago.example/subscription/sub_created",
    });
  });

  it("treats missing subscription Application identity as not found", async () => {
    client.subscriptions.get.mockResolvedValueOnce(
      subscription("sub_missing", null)
    );

    await expect(
      createAdapter().getSubscription("sub_missing")
    ).resolves.toBeNull();
  });

  it("blocks cross-Application subscription mutations", async () => {
    client.subscriptions.get.mockResolvedValueOnce(
      subscription("sub_other", OTHER_APPLICATION_ID)
    );

    await expect(
      createAdapter().cancelSubscription("sub_other")
    ).rejects.toThrow("Subscription not found");
    expect(client.subscriptions.cancel).not.toHaveBeenCalled();
  });
});
