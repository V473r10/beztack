import type { PaymentProviderAdapter } from "@beztack/payments";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureProviderCustomer } from "./provider-customer";

vi.mock("h3", () => ({
  createError(input: { data?: unknown; statusCode?: number; statusMessage?: string }) {
    return Object.assign(new Error(input.statusMessage ?? "Error"), input);
  },
}));

const USER = { id: "user_1", email: "ana@example.com", name: "Ana" };

function polar(overrides: Partial<Record<"getCustomerByEmail" | "createCustomer", unknown>> = {}) {
  return {
    provider: "polar",
    getCustomerByEmail: vi.fn().mockResolvedValue(null),
    createCustomer: vi.fn().mockResolvedValue({ id: "cus_1" }),
    ...overrides,
  } as unknown as PaymentProviderAdapter & {
    getCustomerByEmail: ReturnType<typeof vi.fn>;
    createCustomer: ReturnType<typeof vi.fn>;
  };
}

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected a rejection");
}

describe("ensureProviderCustomer", () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it("does nothing for Mercado Pago", async () => {
    const provider = polar();
    (provider as { provider: string }).provider = "mercadopago";

    await ensureProviderCustomer(provider, USER);

    expect(provider.getCustomerByEmail).not.toHaveBeenCalled();
  });

  it("reuses an existing customer", async () => {
    const provider = polar({ getCustomerByEmail: vi.fn().mockResolvedValue({ id: "cus_9" }) });

    await ensureProviderCustomer(provider, USER);

    expect(provider.createCustomer).not.toHaveBeenCalled();
  });

  it("creates the customer when the provider has none", async () => {
    const provider = polar();

    await ensureProviderCustomer(provider, USER);

    expect(provider.createCustomer).toHaveBeenCalledTimes(1);
  });

  it("answers 502 payment_provider_unavailable when the lookup fails, never a raw 500", async () => {
    const provider = polar({
      getCustomerByEmail: vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED for ana@example.com")),
    });

    const error = await captureError(ensureProviderCustomer(provider, USER));

    expect(error).toMatchObject({
      statusCode: 502,
      data: { code: "payment_provider_unavailable" },
    });
    expect(provider.createCustomer).not.toHaveBeenCalled();
  });

  it("answers 422 customer_email_rejected when the lookup is rejected with a 4xx", async () => {
    const provider = polar({
      getCustomerByEmail: vi
        .fn()
        .mockRejectedValue(Object.assign(new Error("bad email ana@example.com"), { statusCode: 422 })),
    });

    const error = await captureError(ensureProviderCustomer(provider, USER));

    expect(error).toMatchObject({ statusCode: 422, data: { code: "customer_email_rejected" } });
  });

  it("keeps the email out of the logs and out of the error", async () => {
    const provider = polar({
      getCustomerByEmail: vi.fn().mockRejectedValue(new Error("no route for ana@example.com")),
    });

    const error = (await captureError(ensureProviderCustomer(provider, USER))) as Error;

    expect(String(warn.mock.calls.flat().join(" "))).not.toContain("ana@example.com");
    expect(error.message).not.toContain("ana@example.com");
  });

  it("treats a CONFLICT on creation as an existing customer", async () => {
    const provider = polar({
      createCustomer: vi.fn().mockRejectedValue(Object.assign(new Error("exists"), { statusCode: 409 })),
    });

    await expect(ensureProviderCustomer(provider, USER)).resolves.toBeUndefined();
  });
});
