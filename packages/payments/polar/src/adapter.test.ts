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

vi.mock("@polar-sh/sdk/2026-10", () => ({
  createPolar: vi.fn(() => sdk.client),
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
    product_id: "prod_pro",
    product: { name: "Pro" },
    customer_id: "cus_1",
    customer: { email: "user@example.com", external_id: "user_1" },
    current_period_start: "2026-06-01T00:00:00.000Z",
    current_period_end: "2026-07-01T00:00:00.000Z",
    cancel_at_period_end: false,
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
    it("maps a recurring Polar product keeping the minor-unit amount untouched", async () => {
      client.products.get.mockResolvedValueOnce({
        id: "prod_pro",
        name: "Pro",
        is_recurring: true,
        recurring_interval: "year",
        prices: [{ price_amount: 2900, price_currency: "usd" }],
        metadata: { tier: "pro" },
      });

      await expect(createAdapter().getProduct("prod_pro")).resolves.toEqual({
        id: "prod_pro",
        name: "Pro",
        description: undefined,
        type: "plan",
        price: { amount: 2900, currency: "USD" },
        interval: "year",
        intervalCount: 1,
        metadata: { tier: "pro", isRecurring: true },
      });
    });

    it.each([
      ["USD", 900],
      ["UYU", 39_000],
      ["JPY", 900],
      ["KWD", 9000],
    ])("reads a %s price from Polar without converting it", async (currency, amount) => {
      client.products.list.mockResolvedValueOnce({
        items: [
          {
            id: "prod_1",
            name: "Basic",
            is_recurring: true,
            recurring_interval: "month",
            prices: [{ price_amount: amount, price_currency: currency.toLowerCase() }],
          },
        ],
      });

      const [product] = await createAdapter().listProducts();

      expect(product?.price).toEqual({ amount, currency });
    });

    it.each([
      ["USD", 900],
      ["UYU", 39_000],
      ["JPY", 900],
      ["KWD", 9000],
    ])("sends a %s price to Polar without converting it", async (currency, amount) => {
      client.products.create.mockResolvedValueOnce({ id: "prod_new", name: "Basic", prices: [] });

      await createAdapter().createProduct({
        name: "Basic",
        type: "plan",
        interval: "month",
        intervalCount: 1,
        price: { amount, currency },
      });

      expect(client.products.create).toHaveBeenCalledWith(
        expect.objectContaining({
          prices: [
            { amount_type: "fixed", price_amount: amount, price_currency: currency.toLowerCase() },
          ],
        }),
      );
    });

    it("sends an updated price to Polar without converting it", async () => {
      client.products.update.mockResolvedValueOnce({ id: "prod_pro", name: "Pro", prices: [] });

      await createAdapter().updateProduct("prod_pro", { price: { amount: 2900, currency: "USD" } });

      expect(client.products.update).toHaveBeenCalledWith("prod_pro", {
        prices: [{ amount_type: "fixed", price_amount: 2900, price_currency: "usd" }],
      });
    });

    it("round-trips a price through create and read without changing it", async () => {
      client.products.create.mockImplementationOnce((request: { prices: unknown[] }) =>
        Promise.resolve({
          id: "prod_new",
          name: "Basic",
          is_recurring: true,
          prices: request.prices,
        }),
      );

      const product = await createAdapter().createProduct({
        name: "Basic",
        type: "plan",
        interval: "month",
        intervalCount: 1,
        price: { amount: 900, currency: "USD" },
      });

      expect(product.price).toEqual({ amount: 900, currency: "USD" });
    });

    it("refuses a price that is not an integer amount of minor units", async () => {
      await expect(
        createAdapter().createProduct({
          name: "Basic",
          type: "plan",
          interval: "month",
          intervalCount: 1,
          price: { amount: 9.5, currency: "USD" },
        }),
      ).rejects.toThrow(RangeError);
      expect(client.products.create).not.toHaveBeenCalled();
    });

    it("treats a missing product as not found", async () => {
      client.products.get.mockRejectedValueOnce(new Error("404"));

      await expect(createAdapter().getProduct("prod_missing")).resolves.toBeNull();
    });

    it("raises a product below Polar's minimum price to the minimum", async () => {
      client.products.create.mockResolvedValueOnce({ id: "prod_new", name: "Tiny", prices: [] });

      await createAdapter().createProduct({
        name: "Tiny",
        type: "plan",
        interval: "month",
        intervalCount: 1,
        price: { amount: 10, currency: "USD" },
      });

      expect(client.products.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recurring_interval: "month",
          prices: [{ amount_type: "fixed", price_amount: 50, price_currency: "usd" }],
        }),
      );
    });

    it("archives instead of deleting", async () => {
      client.products.update.mockResolvedValueOnce({});

      await createAdapter().deleteProduct("prod_pro");

      expect(client.products.update).toHaveBeenCalledWith("prod_pro", { is_archived: true });
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

      expect(client.subscriptions.update).toHaveBeenNthCalledWith(1, "sub_1", {
        cancel_at_period_end: true,
      });
      expect(atPeriodEnd).toMatchObject({ status: "active", cancelAtPeriodEnd: true });
      expect(immediately).toMatchObject({ status: "canceled", cancelAtPeriodEnd: false });
    });

    it("lists by Polar customer id when given a UUID, else by external id", async () => {
      client.subscriptions.list.mockResolvedValue({ items: [polarSubscription()] });
      const adapter = createAdapter();

      await adapter.listSubscriptions({ customerId: CUSTOMER_UUID });
      const [subscription] = await adapter.listSubscriptions({ customerId: "user_1" });

      expect(client.subscriptions.list).toHaveBeenNthCalledWith(1, {
        customer_id: CUSTOMER_UUID,
        external_customer_id: undefined,
        limit: 50,
      });
      expect(client.subscriptions.list).toHaveBeenNthCalledWith(2, {
        customer_id: undefined,
        external_customer_id: "user_1",
        limit: 50,
      });
      expect(subscription.customerId).toBe("user_1");
    });

    it("lists nothing when the customer email is unknown", async () => {
      client.customers.list.mockResolvedValueOnce({ items: [] });

      await expect(
        createAdapter().listSubscriptions({ customerEmail: "nobody@example.com" }),
      ).resolves.toEqual([]);
      expect(client.subscriptions.list).not.toHaveBeenCalled();
    });
  });

  describe("updateSubscription({ productId })", () => {
    it("moves the Subscription with Polar's native product change", async () => {
      client.subscriptions.update.mockResolvedValueOnce(
        polarSubscription({ product_id: "prod_basic", product: { name: "Basic" } }),
      );

      const updated = await createAdapter().updateSubscription("sub_1", {
        productId: "prod_basic",
        prorationBehavior: "prorate",
      });

      expect(client.subscriptions.update).toHaveBeenCalledWith("sub_1", {
        product_id: "prod_basic",
        proration_behavior: "prorate",
      });
      expect(updated).toMatchObject({ productId: "prod_basic", productName: "Basic" });
    });

    it("sends no proration behavior for 'none'", async () => {
      client.subscriptions.update.mockResolvedValueOnce(
        polarSubscription({ product_id: "prod_basic" }),
      );

      await createAdapter().updateSubscription("sub_1", {
        productId: "prod_basic",
        prorationBehavior: "none",
      });

      expect(client.subscriptions.update).toHaveBeenCalledWith("sub_1", {
        product_id: "prod_basic",
        proration_behavior: undefined,
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

  describe("customers", () => {
    it("links the customer to our user id and name when creating it", async () => {
      client.customers.create.mockResolvedValueOnce({
        id: CUSTOMER_UUID,
        email: "user@example.com",
        name: "User",
        external_id: "user_1",
        metadata: { source: "beztack-checkout" },
      });

      const customer = await createAdapter().createCustomer(
        "user@example.com",
        { source: "beztack-checkout" },
        { externalId: "user_1", name: "User" },
      );

      expect(client.customers.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "user@example.com",
          name: "User",
          external_id: "user_1",
        }),
      );
      expect(customer).toMatchObject({ id: CUSTOMER_UUID, externalId: "user_1" });
    });
  });
});
