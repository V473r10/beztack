import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  applyAdminTierOverride: vi.fn(),
  enrichProductWithCatalog: vi.fn(),
  ensurePaymentProvider: vi.fn(),
  canManageBilling: vi.fn(),
  isAppAdminActor: vi.fn(),
  readBody: vi.fn(),
  resolveCheckoutCallbackUrls: vi.fn(),
  requireAuth: vi.fn(),
  env: {
    APP_ADMIN_EMAILS: "admin@example.com",
    PAYMENT_PROVIDER: "polar",
    PAYMENTS_CANCEL_URL: "",
    PAYMENTS_SUCCESS_URL: "",
    POLAR_CANCEL_URL: "",
    POLAR_SUCCESS_URL: "",
    SUBSCRIPTION_MODE: "user" as "user" | "organization",
  },
}));

vi.mock("h3", () => ({
  createError(input: {
    data?: unknown;
    message?: string;
    statusCode?: number;
    statusMessage?: string;
  }) {
    return Object.assign(new Error(input.message ?? input.statusMessage ?? "Error"), {
      data: input.data,
      statusCode: input.statusCode,
    });
  },
  defineEventHandler(handler: unknown) {
    return handler;
  },
  readBody: mocks.readBody,
}));

vi.mock("@/env", () => ({ env: mocks.env }));
vi.mock("@/lib/payments", () => ({
  ensurePaymentProvider: mocks.ensurePaymentProvider,
}));
vi.mock("@/lib/payments/catalog", () => ({
  resolveProductByCanonicalPlan: vi.fn(),
}));
vi.mock("@/lib/payments/catalog-mp", () => ({
  enrichProductWithCatalog: mocks.enrichProductWithCatalog,
}));
vi.mock("@/server/utils/admin-tier-override", () => ({
  applyAdminTierOverride: mocks.applyAdminTierOverride,
}));
vi.mock("@/server/domain/organization-access", () => ({
  getAppAdminEmails: () => ["admin@example.com"],
  organizationAccess: {
    isAppAdmin: mocks.isAppAdminActor,
    canManageBilling: mocks.canManageBilling,
  },
}));
vi.mock("@/server/utils/billing-amount-resolver", () => ({
  estimatePeriodEnd: vi.fn(),
  resolveCurrentBillingAmount: vi.fn(),
}));
vi.mock("@/server/utils/checkout-callback-urls", () => ({
  resolveCheckoutCallbackUrls: mocks.resolveCheckoutCallbackUrls,
}));
vi.mock("@/server/utils/membership", () => ({
  requireAuth: mocks.requireAuth,
}));
vi.mock("@/server/utils/subscription-discovery", () => ({
  discoverSubscriptionsFromDb: vi.fn(),
}));
describe("POST /api/subscriptions/checkout", () => {
  it("applies an Admin tier override before initializing the payment provider", async () => {
    const handler = (await import("../routes/api/subscriptions/checkout.post")).default as (
      event: unknown,
    ) => Promise<unknown>;
    mocks.requireAuth.mockResolvedValue({
      user: {
        id: "admin_1",
        email: "admin@example.com",
        role: "sudo",
      },
      session: {},
    });
    mocks.readBody.mockResolvedValue({
      billingPeriod: "monthly",
      productId: "prod_pro_month",
    });
    mocks.isAppAdminActor.mockReturnValue(true);
    mocks.applyAdminTierOverride.mockResolvedValue({
      kind: "admin-tier-override",
      changed: true,
      target: { type: "user", id: "admin_1" },
      override: {
        tier: "pro",
        billingCadence: "monthly",
      },
    });

    const response = await handler({});

    expect(mocks.ensurePaymentProvider).not.toHaveBeenCalled();
    expect(mocks.applyAdminTierOverride).toHaveBeenCalledWith(
      expect.objectContaining({
        billingPeriod: "monthly",
        productId: "prod_pro_month",
        provider: "polar",
        sourceAction: "checkout",
        subscriptionMode: "user",
        userId: "admin_1",
      }),
    );
    expect(response).toEqual({
      provider: "beztack",
      resultKind: "admin-tier-override",
      changed: true,
      adminTierOverride: {
        target: { type: "user", id: "admin_1" },
        tier: "pro",
        billingCadence: "monthly",
        realSubscriptionsUnchanged: true,
      },
    });
  });

  describe("provider customer", () => {
    const PRODUCT = { id: "prod_pro_month", metadata: { tier: "pro" } };

    function setupVisitorCheckout(providerName: "polar" | "mercadopago" = "polar") {
      const provider = {
        provider: providerName,
        listProducts: vi.fn().mockResolvedValue([PRODUCT]),
        getCustomerByEmail: vi.fn().mockResolvedValue(null),
        createCustomer: vi.fn().mockResolvedValue({ id: "cus_1", email: "visitor@example.com" }),
        createCheckout: vi
          .fn()
          .mockResolvedValue({ id: "chk_1", url: "https://sandbox.polar.sh/checkout/chk_1" }),
      };
      mocks.ensurePaymentProvider.mockResolvedValue(provider);
      mocks.requireAuth.mockResolvedValue({
        user: { id: "user_1", email: "visitor@example.com", name: "Visitor", role: "user" },
        session: {},
      });
      mocks.readBody.mockResolvedValue({ billingPeriod: "monthly", productId: PRODUCT.id });
      mocks.isAppAdminActor.mockReturnValue(false);
      mocks.resolveCheckoutCallbackUrls.mockReturnValue({
        successUrl: "https://app.example.com/ok",
        cancelUrl: "https://app.example.com/cancel",
      });
      mocks.enrichProductWithCatalog.mockImplementation(async (product: unknown) => product);
      mocks.env.PAYMENT_PROVIDER = providerName;
      return provider;
    }

    async function callHandler() {
      const handler = (await import("../routes/api/subscriptions/checkout.post")).default as (
        event: unknown,
      ) => Promise<unknown>;
      return handler({});
    }

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("creates the customer when the provider has none, then opens the checkout", async () => {
      const provider = setupVisitorCheckout();

      const response = await callHandler();

      expect(provider.createCustomer).toHaveBeenCalledWith(
        "visitor@example.com",
        expect.objectContaining({ userId: "user_1" }),
        { externalId: "user_1", name: "Visitor" },
      );
      expect(response).toEqual({
        provider: "polar",
        checkoutId: "chk_1",
        checkoutUrl: "https://sandbox.polar.sh/checkout/chk_1",
      });
    });

    it("reuses the customer the provider already has", async () => {
      const provider = setupVisitorCheckout();
      provider.getCustomerByEmail.mockResolvedValue({ id: "cus_1", email: "visitor@example.com" });

      await callHandler();

      expect(provider.createCustomer).not.toHaveBeenCalled();
      expect(provider.createCheckout).toHaveBeenCalledTimes(1);
    });

    it("treats a CONFLICT on customer creation as success", async () => {
      const provider = setupVisitorCheckout();
      provider.createCustomer.mockRejectedValue(
        Object.assign(new Error("conflict"), { statusCode: 409 }),
      );

      await callHandler();

      expect(provider.createCheckout).toHaveBeenCalledTimes(1);
    });

    it("answers 422 customer_email_rejected when the provider rejects the email", async () => {
      const provider = setupVisitorCheckout();
      provider.createCustomer.mockRejectedValue(
        Object.assign(new Error("Polar API returned an error: 422 - visitor@example.com"), {
          statusCode: 422,
        }),
      );

      await expect(callHandler()).rejects.toMatchObject({
        statusCode: 422,
        data: { code: "customer_email_rejected" },
      });
      expect(provider.createCheckout).not.toHaveBeenCalled();
    });

    it("answers 502 payment_provider_unavailable when the provider is down", async () => {
      const provider = setupVisitorCheckout();
      provider.createCustomer.mockRejectedValue(new Error("Polar API network error: fetch failed"));

      await expect(callHandler()).rejects.toMatchObject({
        statusCode: 502,
        data: { code: "payment_provider_unavailable" },
      });
      expect(provider.createCheckout).not.toHaveBeenCalled();
    });

    it("leaves Mercado Pago checkout untouched (no customer lookup or creation)", async () => {
      const provider = setupVisitorCheckout("mercadopago");

      await callHandler();

      expect(provider.getCustomerByEmail).not.toHaveBeenCalled();
      expect(provider.createCustomer).not.toHaveBeenCalled();
      expect(provider.createCheckout).toHaveBeenCalledTimes(1);
    });
  });
  describe("organization subscription mode", () => {
    const PRODUCT = { id: "prod_pro_month", metadata: { tier: "pro" } };

    function setupOrganizationCheckout(session: Record<string, unknown>) {
      const provider = {
        provider: "polar",
        listProducts: vi.fn().mockResolvedValue([PRODUCT]),
        getCustomerByEmail: vi.fn().mockResolvedValue({ id: "cus_1" }),
        createCheckout: vi
          .fn()
          .mockResolvedValue({ id: "chk_1", url: "https://sandbox.polar.sh/checkout/chk_1" }),
      };
      mocks.env.SUBSCRIPTION_MODE = "organization";
      mocks.env.PAYMENT_PROVIDER = "polar";
      mocks.ensurePaymentProvider.mockResolvedValue(provider);
      mocks.requireAuth.mockResolvedValue({
        user: { id: "user_1", email: "visitor@example.com", name: "Visitor", role: "user" },
        session,
      });
      mocks.readBody.mockResolvedValue({ billingPeriod: "monthly", productId: PRODUCT.id });
      mocks.isAppAdminActor.mockReturnValue(false);
      mocks.canManageBilling.mockResolvedValue(true);
      mocks.resolveCheckoutCallbackUrls.mockReturnValue({
        successUrl: "https://app.example.com/ok",
        cancelUrl: "https://app.example.com/cancel",
      });
      mocks.enrichProductWithCatalog.mockImplementation(async (product: unknown) => product);
      return provider;
    }

    async function callHandler() {
      const handler = (await import("../routes/api/subscriptions/checkout.post")).default as (
        event: unknown,
      ) => Promise<unknown>;
      return handler({});
    }

    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      mocks.env.SUBSCRIPTION_MODE = "user";
    });

    it("answers 409 organization_required when the user has no organization", async () => {
      const provider = setupOrganizationCheckout({ activeOrganizationId: null });

      await expect(callHandler()).rejects.toMatchObject({
        statusCode: 409,
        data: { code: "organization_required" },
      });
      expect(provider.createCheckout).not.toHaveBeenCalled();
    });

    it("charges the Active organization", async () => {
      const provider = setupOrganizationCheckout({ activeOrganizationId: "org_1" });

      await callHandler();

      expect(mocks.canManageBilling).toHaveBeenCalledWith(
        expect.objectContaining({ id: "user_1" }),
        "org_1",
      );
      expect(provider.createCheckout).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ organizationId: "org_1", userId: "user_1" }),
        }),
      );
    });

    it("uses the organization the caller names over the Active organization", async () => {
      const provider = setupOrganizationCheckout({ activeOrganizationId: null });
      mocks.readBody.mockResolvedValue({
        billingPeriod: "monthly",
        productId: PRODUCT.id,
        organizationId: "org_new",
      });

      await callHandler();

      expect(provider.createCheckout).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ organizationId: "org_new" }),
        }),
      );
    });

    it("answers 403 to a member who is not a Billing manager", async () => {
      const provider = setupOrganizationCheckout({ activeOrganizationId: "org_1" });
      mocks.canManageBilling.mockResolvedValue(false);

      await expect(callHandler()).rejects.toMatchObject({ statusCode: 403 });
      expect(provider.createCheckout).not.toHaveBeenCalled();
    });
  });
});
