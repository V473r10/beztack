import { isSubscriptionUpdateNotAppliedError } from "@beztack/payments";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPolarAdapter } from "./adapter.js";

const sdk = vi.hoisted(() => ({
  client: {
    products: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn() },
    checkouts: { create: vi.fn() },
    subscriptions: { get: vi.fn(), update: vi.fn(), list: vi.fn() },
    customers: { create: vi.fn(), get: vi.fn(), list: vi.fn() },
    customerSessions: { create: vi.fn() },
  },
}));

vi.mock("@polar-sh/sdk", () => ({
  Polar: vi.fn(() => sdk.client),
}));

const client = sdk.client;
const CUSTOMER_UUID = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";

function createAdapter() {
  return createPolarAdapter({
    accessToken: "polar-token",
    server: "sandbox",
    organizationId: "org_1",
    successUrl: "https://example.com/success",
  });
}

function polarSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_1",
    status: "active",
    productId: "prod_pro",
    product: { name: "Pro" },
    customerId: "cus_1",
    customer: { email: "user@example.com", externalId: "user_1" },
    currentPeriodStart: "2026-06-01T00:00:00.000Z",
    currentPeriodEnd: "2026-07-01T00:00:00.000Z",
    cancelAtPeriodEnd: false,
    metadata: { tier: "pro" },
    ...overrides,
  };
}

describe("createPolarAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  it("declares that it can change Billing cadence", () => {
    expect(createAdapter().capabilities.cadenceChange).toBe(true);
  });

  describe("products", () => {
    it("maps a recurring Polar product from cents to the price amount", async () => {
      client.products.get.mockResolvedValueOnce({
        id: "prod_pro",
        name: "Pro",
        isRecurring: true,
        recurringInterval: "year",
        prices: [{ priceAmount: 2900, priceCurrency: "usd" }],
        metadata: { tier: "pro" },
      });

      await expect(createAdapter().getProduct("prod_pro")).resolves.toEqual({
        id: "prod_pro",
        name: "Pro",
        description: undefined,
        type: "plan",
        price: { amount: 29, currency: "USD" },
        interval: "year",
        intervalCount: 1,
        metadata: { tier: "pro", isRecurring: true },
      });
    });

    it("treats a missing product as not found", async () => {
      client.products.get.mockRejectedValueOnce(new Error("404"));

      await expect(createAdapter().getProduct("prod_missing")).resolves.toBeNull();
    });

    it("creates a product in cents, raising it to Polar's minimum price", async () => {
      client.products.create.mockResolvedValueOnce({ id: "prod_new", name: "Tiny", prices: [] });

      await createAdapter().createProduct({
        name: "Tiny",
        type: "plan",
        interval: "month",
        intervalCount: 1,
        price: { amount: 0.1, currency: "USD" },
      });

      expect(client.products.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recurringInterval: "month",
          prices: [{ amountType: "fixed", priceAmount: 50, priceCurrency: "usd" }],
        }),
      );
    });

    it("archives instead of deleting", async () => {
      client.products.update.mockResolvedValueOnce({});

      await createAdapter().deleteProduct("prod_pro");

      expect(client.products.update).toHaveBeenCalledWith({
        id: "prod_pro",
        productUpdate: { isArchived: true },
      });
    });
  });

  describe("subscriptions", () => {
    it.each([
      ["active", "active"],
      ["past_due", "past_due"],
      ["incomplete", "pending"],
      ["canceled", "canceled"],
      ["unpaid", "inactive"],
    ])("maps Polar status %s to %s", async (polarStatus, status) => {
      client.subscriptions.get.mockResolvedValueOnce(polarSubscription({ status: polarStatus }));

      const subscription = await createAdapter().getSubscription("sub_1");

      expect(subscription?.status).toBe(status);
    });

    it("requires a productId to start a subscription checkout", async () => {
      await expect(
        createAdapter().createSubscription({ customerEmail: "user@example.com" }),
      ).rejects.toThrow("productId is required");
    });

    it("cancels at period end unless asked to cancel immediately", async () => {
      client.subscriptions.update.mockResolvedValue(polarSubscription());
      const adapter = createAdapter();

      const atPeriodEnd = await adapter.cancelSubscription("sub_1");
      const immediately = await adapter.cancelSubscription("sub_1", true);

      expect(client.subscriptions.update).toHaveBeenNthCalledWith(1, {
        id: "sub_1",
        subscriptionUpdate: { cancelAtPeriodEnd: true },
      });
      expect(atPeriodEnd).toMatchObject({ status: "active", cancelAtPeriodEnd: true });
      expect(immediately).toMatchObject({ status: "canceled", cancelAtPeriodEnd: false });
    });

    it("lists by Polar customer id when given a UUID, else by external id", async () => {
      client.subscriptions.list.mockResolvedValue({ result: { items: [polarSubscription()] } });
      const adapter = createAdapter();

      await adapter.listSubscriptions({ customerId: CUSTOMER_UUID });
      const [subscription] = await adapter.listSubscriptions({ customerId: "user_1" });

      expect(client.subscriptions.list).toHaveBeenNthCalledWith(1, {
        customerId: CUSTOMER_UUID,
        externalCustomerId: undefined,
        limit: 50,
      });
      expect(client.subscriptions.list).toHaveBeenNthCalledWith(2, {
        customerId: undefined,
        externalCustomerId: "user_1",
        limit: 50,
      });
      expect(subscription.customerId).toBe("user_1");
    });

    it("lists nothing when the customer email is unknown", async () => {
      client.customers.list.mockResolvedValueOnce({ result: { items: [] } });

      await expect(
        createAdapter().listSubscriptions({ customerEmail: "nobody@example.com" }),
      ).resolves.toEqual([]);
      expect(client.subscriptions.list).not.toHaveBeenCalled();
    });
  });

  describe("updateSubscription({ productId })", () => {
    it("moves the Subscription with Polar's native product change", async () => {
      client.subscriptions.update.mockResolvedValueOnce(
        polarSubscription({ productId: "prod_basic", product: { name: "Basic" } }),
      );

      const updated = await createAdapter().updateSubscription("sub_1", {
        productId: "prod_basic",
        prorationBehavior: "prorate",
      });

      expect(client.subscriptions.update).toHaveBeenCalledWith({
        id: "sub_1",
        subscriptionUpdate: { productId: "prod_basic", prorationBehavior: "prorate" },
      });
      expect(updated).toMatchObject({ productId: "prod_basic", productName: "Basic" });
    });

    it("sends no proration behavior for 'none'", async () => {
      client.subscriptions.update.mockResolvedValueOnce(
        polarSubscription({ productId: "prod_basic" }),
      );

      await createAdapter().updateSubscription("sub_1", {
        productId: "prod_basic",
        prorationBehavior: "none",
      });

      expect(client.subscriptions.update).toHaveBeenCalledWith({
        id: "sub_1",
        subscriptionUpdate: { productId: "prod_basic", prorationBehavior: undefined },
      });
    });

    it("refuses when Polar keeps the Subscription on another product", async () => {
      client.subscriptions.update.mockResolvedValueOnce(polarSubscription());

      const error = await createAdapter()
        .updateSubscription("sub_1", { productId: "prod_basic" })
        .catch((caught: unknown) => caught);

      expect(isSubscriptionUpdateNotAppliedError(error)).toBe(true);
      expect(error).toMatchObject({
        subscriptionId: "sub_1",
        message: "Polar kept the Subscription on prod_pro instead of prod_basic",
      });
    });
  });

  describe("webhooks", () => {
    it.each([
      ["subscription.active", "subscription.active"],
      ["subscription.canceled", "subscription.canceled"],
      ["order.paid", "payment.success"],
      ["customer.created", "customer.created"],
      ["subscription.updated", "subscription.updated"],
    ])("maps Polar event %s to %s", async (polarType, type) => {
      const payload = await createAdapter().parseWebhook(JSON.stringify({ type: polarType }), "");

      expect(payload).toMatchObject({ type, provider: "polar" });
    });
  });
});
