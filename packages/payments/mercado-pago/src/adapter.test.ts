import type { Product, Subscription } from "@beztack/payments";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAdapter as createAdapterFromEnv, createMercadoPagoAdapter } from "./adapter.js";
import { createMercadoPagoClient } from "./server/client.js";
import type { MPPreapproval, MPPreapprovalPlan } from "./types.js";

vi.mock("./server/client.js", () => ({
  createMercadoPagoClient: vi.fn(),
}));

const APPLICATION_ID = "123456789";
// Deliberately not the fixtures' "UYU": a request carrying it proves the
// project default was used rather than the resource's own currency.
const PROJECT_CURRENCY = "EUR";
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
    currency: PROJECT_CURRENCY,
  });
}

function plan(
  id: string,
  applicationId: string | number | null = APPLICATION_ID,
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
  applicationId: string | number | null = APPLICATION_ID,
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
        currency: PROJECT_CURRENCY,
      }),
    ).toThrow("MERCADO_PAGO_APPLICATION_ID");
  });

  describe("project currency", () => {
    const factoryConfig = {
      MERCADO_PAGO_ACCESS_TOKEN: "access-token",
      MERCADO_PAGO_APPLICATION_ID: APPLICATION_ID,
      PAYMENTS_SUCCESS_URL: "https://example.com/success",
    };

    it("requires the project default currency", () => {
      expect(() =>
        createMercadoPagoAdapter({
          accessToken: "access-token",
          applicationId: APPLICATION_ID,
          successUrl: "https://example.com/success",
          currency: "",
        }),
      ).toThrow("DEFAULT_CURRENCY");
    });

    it("refuses to build from env config without DEFAULT_CURRENCY", () => {
      expect(() => createAdapterFromEnv(factoryConfig)).toThrow("DEFAULT_CURRENCY");
    });

    it("uses DEFAULT_CURRENCY from env config when a custom plan has no currency", async () => {
      client.subscriptions.create.mockResolvedValueOnce(subscription("sub_created"));

      await createAdapterFromEnv({ ...factoryConfig, DEFAULT_CURRENCY: "JPY" }).createSubscription({
        customerEmail: "payer@example.com",
        customPlan: {
          reason: "Custom",
          amount: 500,
          currency: "",
          interval: "month",
          intervalCount: 1,
        },
      });

      expect(client.subscriptions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          auto_recurring: expect.objectContaining({ currency_id: "JPY" }),
        }),
      );
    });

    it("creates a plan in the price's own currency, not the project default", async () => {
      client.plans.create.mockResolvedValueOnce(plan("plan_created"));

      await createAdapter().createProduct({
        name: "Pro",
        type: "plan",
        price: { amount: 1000, currency: "UYU" },
        interval: "month",
        intervalCount: 1,
      });

      expect(client.plans.create).toHaveBeenCalledWith(
        expect.objectContaining({
          auto_recurring: expect.objectContaining({ currency_id: "UYU" }),
        }),
      );
    });

    it("creates a plan in the project default when the price carries no currency", async () => {
      client.plans.create.mockResolvedValueOnce(plan("plan_created"));

      await createAdapter().createProduct({
        name: "Pro",
        type: "plan",
        price: { amount: 1000, currency: "" },
        interval: "month",
        intervalCount: 1,
      });

      expect(client.plans.create).toHaveBeenCalledWith(
        expect.objectContaining({
          auto_recurring: expect.objectContaining({ currency_id: PROJECT_CURRENCY }),
        }),
      );
    });

    it("checks out in the plan's own currency, not the project default", async () => {
      client.plans.get.mockResolvedValueOnce(plan("plan_match"));
      client.subscriptions.create.mockResolvedValueOnce(subscription("sub_created"));

      await createAdapter().createCheckout({
        productId: "plan_match",
        customerEmail: "payer@example.com",
        successUrl: "https://example.com/success",
      });

      expect(client.subscriptions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          auto_recurring: expect.objectContaining({ currency_id: "UYU" }),
        }),
      );
    });
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

    expect(products.map((product: Product) => product.id)).toEqual(["plan_match"]);
    expect(client.plans.list).toHaveBeenCalledTimes(2);
  });

  it("treats cross-Application plan reads as not found", async () => {
    client.plans.get.mockResolvedValueOnce(plan("plan_other", OTHER_APPLICATION_ID));

    await expect(createAdapter().getProduct("plan_other")).resolves.toBeNull();
  });

  it("blocks cross-Application plan mutations", async () => {
    client.plans.get.mockResolvedValueOnce(plan("plan_other", OTHER_APPLICATION_ID));

    await expect(createAdapter().updateProduct("plan_other", { name: "New name" })).rejects.toThrow(
      "Product not found",
    );
    expect(client.plans.update).not.toHaveBeenCalled();
  });

  it("verifies newly created plans belong to the configured Application", async () => {
    client.plans.create.mockResolvedValueOnce(plan("plan_other", OTHER_APPLICATION_ID));

    await expect(
      createAdapter().createProduct({
        name: "Pro",
        type: "plan",
        price: { amount: 1000, currency: "UYU" },
        interval: "month",
        intervalCount: 1,
      }),
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

    expect(subscriptions.map((item: Subscription) => item.id)).toEqual(["sub_match"]);
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
      }),
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
      }),
    );
    expect(checkout).toEqual({
      id: "sub_created",
      url: "https://mercadopago.example/subscription/sub_created",
    });
  });

  it("treats missing subscription Application identity as not found", async () => {
    client.subscriptions.get.mockResolvedValueOnce(subscription("sub_missing", null));

    await expect(createAdapter().getSubscription("sub_missing")).resolves.toBeNull();
  });

  it("blocks cross-Application subscription mutations", async () => {
    client.subscriptions.get.mockResolvedValueOnce(subscription("sub_other", OTHER_APPLICATION_ID));

    await expect(createAdapter().cancelSubscription("sub_other")).rejects.toThrow(
      "Subscription not found",
    );
    expect(client.subscriptions.cancel).not.toHaveBeenCalled();
  });

  describe("updateSubscription({ productId })", () => {
    function targetPlan(
      amount: number,
      overrides: Partial<MPPreapprovalPlan["auto_recurring"]> = {},
    ) {
      const result = plan("plan_basic");
      result.auto_recurring = {
        ...result.auto_recurring,
        transaction_amount: amount,
        ...overrides,
      };
      return result;
    }

    function withAmount(amount: number): MPPreapproval {
      const result = subscription("sub_1");
      result.auto_recurring = { ...result.auto_recurring, transaction_amount: amount };
      return result;
    }

    it("changes the amount of the existing subscription to the target plan's", async () => {
      client.plans.get.mockResolvedValueOnce(targetPlan(500));
      client.subscriptions.get
        .mockResolvedValueOnce(withAmount(1000))
        .mockResolvedValueOnce(withAmount(500));

      const updated = await createAdapter().updateSubscription("sub_1", {
        productId: "plan_basic",
      });

      expect(client.plans.get).toHaveBeenCalledWith("plan_basic");
      expect(client.subscriptions.update).toHaveBeenCalledWith("sub_1", {
        auto_recurring: { transaction_amount: 500 },
      });
      expect(updated.metadata?.billingAmount).toBe(500);
    });

    it("refuses when Mercado Pago returns another amount", async () => {
      client.plans.get.mockResolvedValueOnce(targetPlan(500));
      client.subscriptions.get
        .mockResolvedValueOnce(withAmount(1000))
        .mockResolvedValueOnce(withAmount(1000));

      await expect(
        createAdapter().updateSubscription("sub_1", { productId: "plan_basic" }),
      ).rejects.toMatchObject({ name: "SubscriptionUpdateNotAppliedError" });
    });

    it.each([
      { label: "frequency", overrides: { frequency: 12 } },
      { label: "currency", overrides: { currency_id: "USD" } },
    ])(
      "refuses a target plan with another $label without calling Mercado Pago",
      async ({ overrides }) => {
        client.plans.get.mockResolvedValueOnce(targetPlan(500, overrides));
        client.subscriptions.get.mockResolvedValueOnce(withAmount(1000));

        await expect(
          createAdapter().updateSubscription("sub_1", { productId: "plan_basic" }),
        ).rejects.toMatchObject({ name: "SubscriptionUpdateNotAppliedError" });
        expect(client.subscriptions.update).not.toHaveBeenCalled();
      },
    );

    it("refuses a target plan from another Application", async () => {
      client.plans.get.mockResolvedValueOnce(plan("plan_other", OTHER_APPLICATION_ID));
      client.subscriptions.get.mockResolvedValueOnce(withAmount(1000));

      await expect(
        createAdapter().updateSubscription("sub_1", { productId: "plan_other" }),
      ).rejects.toThrow("does not belong");
      expect(client.subscriptions.update).not.toHaveBeenCalled();
    });
  });
});
