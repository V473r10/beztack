import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMercadoPagoClient,
  type MercadoPagoConfig,
  MercadoPagoError,
} from "./client.js";

// Test constants
const ACCESS_TOKEN = "TEST-ACCESS-TOKEN-123";
const WEBHOOK_SECRET = "webhook-secret-key";
const DATA_ID = "12345";
const REQUEST_ID = "req-abc-123";
const TIMESTAMP = "1704067200";
const CUSTOM_TIMEOUT = 60_000;
const CUSTOM_MAX_RETRIES = 5;
const STATUS_OK = 200;
const STATUS_NO_CONTENT = 204;
const STATUS_BAD_REQUEST = 400;
const STATUS_NOT_FOUND = 404;
const STATUS_RATE_LIMITED = 429;
const STATUS_SERVER_ERROR = 500;
const STATUS_SERVICE_UNAVAILABLE = 503;
const WEBHOOK_ID = 12_345;
const WEBHOOK_USER_ID = 67_890;

describe("server/client", () => {
  describe("createMercadoPagoClient", () => {
    it("creates a client with all modules", () => {
      const client = createMercadoPagoClient({ accessToken: ACCESS_TOKEN });

      expect(client.config).toBeDefined();
      expect(client.webhooks).toBeDefined();
      expect(client.payments).toBeDefined();
      expect(client.plans).toBeDefined();
      expect(client.subscriptions).toBeDefined();
      expect(client.customers).toBeDefined();
      expect(client.checkout).toBeDefined();
      expect(client.invoices).toBeDefined();
      expect(client.merchantOrders).toBeDefined();
      expect(client.chargebacks).toBeDefined();
    });

    it("preserves config in client", () => {
      const config: MercadoPagoConfig = {
        accessToken: ACCESS_TOKEN,
        webhookSecret: WEBHOOK_SECRET,
        timeout: CUSTOM_TIMEOUT,
        maxRetries: CUSTOM_MAX_RETRIES,
      };
      const client = createMercadoPagoClient(config);

      expect(client.config.accessToken).toBe(ACCESS_TOKEN);
      expect(client.config.webhookSecret).toBe(WEBHOOK_SECRET);
      expect(client.config.timeout).toBe(CUSTOM_TIMEOUT);
      expect(client.config.maxRetries).toBe(CUSTOM_MAX_RETRIES);
    });
  });

  describe("MercadoPagoError", () => {
    it("creates error with all properties", () => {
      const error = new MercadoPagoError(
        "Test error",
        STATUS_BAD_REQUEST,
        { foo: "bar" },
        true
      );

      expect(error.message).toBe("Test error");
      expect(error.statusCode).toBe(STATUS_BAD_REQUEST);
      expect(error.errorCause).toEqual({ foo: "bar" });
      expect(error.retryable).toBe(true);
      expect(error.name).toBe("MercadoPagoError");
    });

    it("defaults retryable to false", () => {
      const error = new MercadoPagoError("Test error", STATUS_SERVER_ERROR);

      expect(error.retryable).toBe(false);
    });

    it("is instance of Error", () => {
      const error = new MercadoPagoError("Test error", STATUS_SERVER_ERROR);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(MercadoPagoError);
    });
  });

  describe("webhooks module", () => {
    describe("validate", () => {
      it("returns false when signature is null", () => {
        const client = createMercadoPagoClient({
          accessToken: ACCESS_TOKEN,
          webhookSecret: WEBHOOK_SECRET,
        });

        const result = client.webhooks.validate(null, REQUEST_ID, DATA_ID);
        expect(result).toBe(false);
      });

      it("returns false when requestId is null", () => {
        const client = createMercadoPagoClient({
          accessToken: ACCESS_TOKEN,
          webhookSecret: WEBHOOK_SECRET,
        });

        const result = client.webhooks.validate("ts=123,v1=abc", null, DATA_ID);
        expect(result).toBe(false);
      });

      it("returns false when signature format is invalid", () => {
        const client = createMercadoPagoClient({
          accessToken: ACCESS_TOKEN,
          webhookSecret: WEBHOOK_SECRET,
        });

        const result = client.webhooks.validate(
          "invalid-signature",
          REQUEST_ID,
          DATA_ID
        );
        expect(result).toBe(false);
      });

      it("returns false when signature is missing ts", () => {
        const client = createMercadoPagoClient({
          accessToken: ACCESS_TOKEN,
          webhookSecret: WEBHOOK_SECRET,
        });

        const result = client.webhooks.validate(
          "v1=abc123",
          REQUEST_ID,
          DATA_ID
        );
        expect(result).toBe(false);
      });

      it("returns false when signature is missing v1", () => {
        const client = createMercadoPagoClient({
          accessToken: ACCESS_TOKEN,
          webhookSecret: WEBHOOK_SECRET,
        });

        const result = client.webhooks.validate("ts=123", REQUEST_ID, DATA_ID);
        expect(result).toBe(false);
      });

      it("validates correct signature", () => {
        const client = createMercadoPagoClient({
          accessToken: ACCESS_TOKEN,
          webhookSecret: WEBHOOK_SECRET,
        });

        // Generate a valid signature
        const manifest = `id:${DATA_ID};request-id:${REQUEST_ID};ts:${TIMESTAMP};`;
        const hmac = createHmac("sha256", WEBHOOK_SECRET);
        hmac.update(manifest);
        const validSignature = hmac.digest("hex");

        const xSignature = `ts=${TIMESTAMP},v1=${validSignature}`;
        const result = client.webhooks.validate(
          xSignature,
          REQUEST_ID,
          DATA_ID
        );

        expect(result).toBe(true);
      });

      it("returns false for invalid signature", () => {
        const client = createMercadoPagoClient({
          accessToken: ACCESS_TOKEN,
          webhookSecret: WEBHOOK_SECRET,
        });

        const xSignature = `ts=${TIMESTAMP},v1=invalid-signature-value`;
        const result = client.webhooks.validate(
          xSignature,
          REQUEST_ID,
          DATA_ID
        );

        expect(result).toBe(false);
      });

      it("allows validation bypass without secret in non-production", () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = "development";

        const client = createMercadoPagoClient({
          accessToken: ACCESS_TOKEN,
          // No webhookSecret
        });

        const result = client.webhooks.validate("any", "any", "any");

        // Should pass in non-production without secret
        expect(result).toBe(true);

        process.env.NODE_ENV = originalEnv;
      });
    });

    describe("parse", () => {
      it("parses webhook payload", () => {
        const client = createMercadoPagoClient({ accessToken: ACCESS_TOKEN });

        const rawBody = JSON.stringify({
          id: WEBHOOK_ID,
          live_mode: true,
          type: "payment",
          date_created: "2024-01-01T00:00:00Z",
          user_id: WEBHOOK_USER_ID,
          api_version: "v1",
          action: "payment.created",
          data: { id: "payment_123" },
        });

        const result = client.webhooks.parse(rawBody);

        expect(result.id).toBe(WEBHOOK_ID);
        expect(result.type).toBe("payment");
        expect(result.action).toBe("payment.created");
        expect(result.data.id).toBe("payment_123");
      });

      it("throws on invalid JSON", () => {
        const client = createMercadoPagoClient({ accessToken: ACCESS_TOKEN });

        expect(() => client.webhooks.parse("not json")).toThrow();
      });
    });
  });

  describe("API methods structure", () => {
    const client = createMercadoPagoClient({ accessToken: ACCESS_TOKEN });

    describe("payments module", () => {
      it("has get method", () => {
        expect(typeof client.payments.get).toBe("function");
      });

      it("has create method", () => {
        expect(typeof client.payments.create).toBe("function");
      });

      it("has search method", () => {
        expect(typeof client.payments.search).toBe("function");
      });

      it("has refund method", () => {
        expect(typeof client.payments.refund).toBe("function");
      });

      it("has getRefunds method", () => {
        expect(typeof client.payments.getRefunds).toBe("function");
      });
    });

    describe("plans module", () => {
      it("has list method", () => {
        expect(typeof client.plans.list).toBe("function");
      });

      it("has get method", () => {
        expect(typeof client.plans.get).toBe("function");
      });

      it("has create method", () => {
        expect(typeof client.plans.create).toBe("function");
      });

      it("has update method", () => {
        expect(typeof client.plans.update).toBe("function");
      });

      it("has deactivate method", () => {
        expect(typeof client.plans.deactivate).toBe("function");
      });
    });

    describe("subscriptions module", () => {
      it("has create method", () => {
        expect(typeof client.subscriptions.create).toBe("function");
      });

      it("has get method", () => {
        expect(typeof client.subscriptions.get).toBe("function");
      });

      it("has update method", () => {
        expect(typeof client.subscriptions.update).toBe("function");
      });

      it("has cancel method", () => {
        expect(typeof client.subscriptions.cancel).toBe("function");
      });

      it("has pause method", () => {
        expect(typeof client.subscriptions.pause).toBe("function");
      });

      it("has resume method", () => {
        expect(typeof client.subscriptions.resume).toBe("function");
      });

      it("has search method", () => {
        expect(typeof client.subscriptions.search).toBe("function");
      });

      it("has listInvoices method", () => {
        expect(typeof client.subscriptions.listInvoices).toBe("function");
      });
    });

    describe("customers module", () => {
      it("has create method", () => {
        expect(typeof client.customers.create).toBe("function");
      });

      it("has get method", () => {
        expect(typeof client.customers.get).toBe("function");
      });

      it("has searchByEmail method", () => {
        expect(typeof client.customers.searchByEmail).toBe("function");
      });
    });

    describe("checkout module", () => {
      it("has createPreference method", () => {
        expect(typeof client.checkout.createPreference).toBe("function");
      });

      it("has getPreference method", () => {
        expect(typeof client.checkout.getPreference).toBe("function");
      });
    });

    describe("invoices module", () => {
      it("has get method", () => {
        expect(typeof client.invoices.get).toBe("function");
      });

      it("has search method", () => {
        expect(typeof client.invoices.search).toBe("function");
      });
    });

    describe("merchantOrders module", () => {
      it("has get method", () => {
        expect(typeof client.merchantOrders.get).toBe("function");
      });
    });

    describe("chargebacks module", () => {
      it("has get method", () => {
        expect(typeof client.chargebacks.get).toBe("function");
      });
    });
  });

  describe("API calls with mocked fetch", () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      vi.resetAllMocks();
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it("makes GET request with correct headers", async () => {
      const mockResponse = { id: 123, status: "approved" };
      // @ts-expect-error - mocking fetch without full type
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: STATUS_OK,
        headers: new Headers({ "content-length": "100" }),
        json: () => Promise.resolve(mockResponse),
      });

      const client = createMercadoPagoClient({ accessToken: ACCESS_TOKEN });
      const result = await client.payments.get("123");

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url, options] = vi.mocked(global.fetch).mock.calls[0];
      expect(url).toBe("https://api.mercadopago.com/v1/payments/123");
      expect(options?.headers).toEqual(
        expect.objectContaining({
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it("makes POST request with body", async () => {
      const mockResponse = { id: "pref_123", init_point: "https://mp.com/..." };
      // @ts-expect-error - mocking fetch without full type
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: STATUS_OK,
        headers: new Headers({ "content-length": "100" }),
        json: () => Promise.resolve(mockResponse),
      });

      const client = createMercadoPagoClient({ accessToken: ACCESS_TOKEN });
      const result = await client.checkout.createPreference({
        items: [{ title: "Test", quantity: 1, unit_price: 100 }],
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [, options] = vi.mocked(global.fetch).mock.calls[0];
      expect(options?.method).toBe("POST");
      expect(options?.body).toContain("Test");
      expect(result).toEqual(mockResponse);
    });

    it("throws MercadoPagoError on API error", async () => {
      // @ts-expect-error - mocking fetch without full type
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: STATUS_NOT_FOUND,
        json: () => Promise.resolve({ message: "Payment not found" }),
      });

      const client = createMercadoPagoClient({
        accessToken: ACCESS_TOKEN,
        maxRetries: 0,
      });

      await expect(client.payments.get("nonexistent")).rejects.toThrow(
        MercadoPagoError
      );
    });

    it("retries on 429 status", async () => {
      const mockResponse = { id: 123 };
      let callCount = 0;

      // @ts-expect-error - mocking fetch without full type
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: STATUS_RATE_LIMITED,
            json: () => Promise.resolve({ message: "Rate limited" }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: STATUS_OK,
          headers: new Headers({ "content-length": "100" }),
          json: () => Promise.resolve(mockResponse),
        });
      });

      const client = createMercadoPagoClient({
        accessToken: ACCESS_TOKEN,
        initialRetryDelay: 10, // Fast for testing
      });

      const result = await client.payments.get("123");

      expect(callCount).toBe(2);
      expect(result).toEqual(mockResponse);
    });

    it("retries on 5xx status", async () => {
      const mockResponse = { id: 123 };
      let callCount = 0;

      // @ts-expect-error - mocking fetch without full type
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: STATUS_SERVICE_UNAVAILABLE,
            json: () => Promise.resolve({ message: "Service unavailable" }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: STATUS_OK,
          headers: new Headers({ "content-length": "100" }),
          json: () => Promise.resolve(mockResponse),
        });
      });

      const client = createMercadoPagoClient({
        accessToken: ACCESS_TOKEN,
        initialRetryDelay: 10,
      });

      const result = await client.payments.get("123");

      expect(callCount).toBe(2);
      expect(result).toEqual(mockResponse);
    });

    it("handles 204 No Content response", async () => {
      // @ts-expect-error - mocking fetch without full type
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: STATUS_NO_CONTENT,
        headers: new Headers({ "content-length": "0" }),
        json: () => Promise.resolve({}),
      });

      const client = createMercadoPagoClient({ accessToken: ACCESS_TOKEN });

      // subscriptions.update returns empty on success sometimes
      const result = await client.subscriptions.update("sub_123", {
        status: "paused",
      });

      expect(result).toEqual({});
    });

    it("uses custom baseUrl when provided", async () => {
      const customBaseUrl = "https://custom.mercadopago.com";
      // @ts-expect-error - mocking fetch without full type
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: STATUS_OK,
        headers: new Headers({ "content-length": "100" }),
        json: () => Promise.resolve({ id: 123 }),
      });

      const client = createMercadoPagoClient({
        accessToken: ACCESS_TOKEN,
        baseUrl: customBaseUrl,
      });

      await client.payments.get("123");

      const [url] = vi.mocked(global.fetch).mock.calls[0];
      expect(url).toBe(`${customBaseUrl}/v1/payments/123`);
    });

    it("builds search URL with query params", async () => {
      // @ts-expect-error - mocking fetch without full type
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: STATUS_OK,
        headers: new Headers({ "content-length": "100" }),
        json: () => Promise.resolve({ paging: { total: 0 }, results: [] }),
      });

      const client = createMercadoPagoClient({ accessToken: ACCESS_TOKEN });

      await client.payments.search({
        status: "approved",
        begin_date: "2024-01-01",
        limit: 10,
      });

      const [url] = vi.mocked(global.fetch).mock.calls[0];
      expect(url).toContain("status=approved");
      expect(url).toContain("begin_date=2024-01-01");
      expect(url).toContain("limit=10");
    });
  });
});
