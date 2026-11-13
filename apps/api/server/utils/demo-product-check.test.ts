import type { PaymentProviderAdapter, Product } from "@beztack/payments";
import { describe, expect, it, vi } from "vitest";
import {
  assertDemoProducts,
  DemoProductCheckError,
  demoProductsFor,
  verifyDemoProducts,
} from "./demo-product-check";

const POLAR_ENV = {
  POLAR_BASIC_MONTHLY_PRODUCT_ID: "id-basic-month",
  POLAR_BASIC_YEARLY_PRODUCT_ID: "id-basic-year",
  POLAR_PRO_MONTHLY_PRODUCT_ID: "id-pro-month",
  POLAR_PRO_YEARLY_PRODUCT_ID: "id-pro-year",
  POLAR_ULTIMATE_MONTHLY_PRODUCT_ID: "id-ultimate-month",
  POLAR_ULTIMATE_YEARLY_PRODUCT_ID: "id-ultimate-year",
};

function product(id: string, tier: string | undefined, interval: "month" | "year"): Product {
  return {
    id,
    name: `${tier ?? "untagged"} ${interval}`,
    type: "plan",
    price: { amount: 1, currency: "USD" },
    interval,
    intervalCount: 1,
    metadata: tier ? { tier } : {},
  };
}

/** A hand-written provider: it knows only the products it is given and never touches the network. */
function fakeProvider(products: Product[]) {
  const getProduct = vi.fn(async (id: string) => products.find((p) => p.id === id) ?? null);
  return { adapter: { getProduct } as Pick<PaymentProviderAdapter, "getProduct">, getProduct };
}

const GOOD_CATALOG = [
  product("id-basic-month", "basic", "month"),
  product("id-basic-year", "basic", "year"),
  product("id-pro-month", "pro", "month"),
  product("id-pro-year", "pro", "year"),
  product("id-ultimate-month", "ultimate", "month"),
  product("id-ultimate-year", "ultimate", "year"),
];

describe("demoProductsFor", () => {
  it("lists the six Polar product variables with the tier and cadence each must have", () => {
    const refs = demoProductsFor("polar", POLAR_ENV);

    expect(refs).toEqual([
      {
        variable: "POLAR_BASIC_MONTHLY_PRODUCT_ID",
        productId: "id-basic-month",
        tier: "basic",
        interval: "month",
      },
      {
        variable: "POLAR_BASIC_YEARLY_PRODUCT_ID",
        productId: "id-basic-year",
        tier: "basic",
        interval: "year",
      },
      {
        variable: "POLAR_PRO_MONTHLY_PRODUCT_ID",
        productId: "id-pro-month",
        tier: "pro",
        interval: "month",
      },
      {
        variable: "POLAR_PRO_YEARLY_PRODUCT_ID",
        productId: "id-pro-year",
        tier: "pro",
        interval: "year",
      },
      {
        variable: "POLAR_ULTIMATE_MONTHLY_PRODUCT_ID",
        productId: "id-ultimate-month",
        tier: "ultimate",
        interval: "month",
      },
      {
        variable: "POLAR_ULTIMATE_YEARLY_PRODUCT_ID",
        productId: "id-ultimate-year",
        tier: "ultimate",
        interval: "year",
      },
    ]);
  });

  it("has nothing to check for Mercado Pago, whose plan ids come from plan sync", () => {
    expect(demoProductsFor("mercadopago", POLAR_ENV)).toEqual([]);
  });
});

describe("verifyDemoProducts", () => {
  it("finds no problem when every product exists with the expected tier and cadence", async () => {
    const { adapter } = fakeProvider(GOOD_CATALOG);

    await expect(verifyDemoProducts(adapter, demoProductsFor("polar", POLAR_ENV))).resolves.toEqual(
      [],
    );
  });

  it("names the variable and the id of a product the provider does not have", async () => {
    const { adapter } = fakeProvider(GOOD_CATALOG.filter((p) => p.id !== "id-pro-year"));

    const problems = await verifyDemoProducts(adapter, demoProductsFor("polar", POLAR_ENV));

    expect(problems).toEqual([
      expect.objectContaining({
        variable: "POLAR_PRO_YEARLY_PRODUCT_ID",
        productId: "id-pro-year",
        reason: expect.stringContaining("not found"),
      }),
    ]);
  });

  it("names the variable when the tier does not match", async () => {
    const wrongTier = GOOD_CATALOG.map((p) =>
      p.id === "id-basic-month" ? product(p.id, "pro", "month") : p,
    );

    const problems = await verifyDemoProducts(
      fakeProvider(wrongTier).adapter,
      demoProductsFor("polar", POLAR_ENV),
    );

    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ variable: "POLAR_BASIC_MONTHLY_PRODUCT_ID" });
    expect(problems[0]?.reason).toContain('tier "pro"');
    expect(problems[0]?.reason).toContain('"basic"');
  });

  it("names the variable when the cadence does not match", async () => {
    const wrongInterval = GOOD_CATALOG.map((p) =>
      p.id === "id-ultimate-year" ? product(p.id, "ultimate", "month") : p,
    );

    const problems = await verifyDemoProducts(
      fakeProvider(wrongInterval).adapter,
      demoProductsFor("polar", POLAR_ENV),
    );

    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ variable: "POLAR_ULTIMATE_YEARLY_PRODUCT_ID" });
    expect(problems[0]?.reason).toContain('"year"');
  });

  it("reports a product that carries no tier metadata", async () => {
    const untagged = GOOD_CATALOG.map((p) =>
      p.id === "id-pro-month" ? product(p.id, undefined, "month") : p,
    );

    const problems = await verifyDemoProducts(
      fakeProvider(untagged).adapter,
      demoProductsFor("polar", POLAR_ENV),
    );

    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ variable: "POLAR_PRO_MONTHLY_PRODUCT_ID" });
    expect(problems[0]?.reason).toContain("metadata.tier");
  });

  it("reports an unset variable without asking the provider for it", async () => {
    const { adapter, getProduct } = fakeProvider(GOOD_CATALOG);

    const problems = await verifyDemoProducts(
      adapter,
      demoProductsFor("polar", { ...POLAR_ENV, POLAR_PRO_MONTHLY_PRODUCT_ID: "" }),
    );

    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ variable: "POLAR_PRO_MONTHLY_PRODUCT_ID", productId: "" });
    expect(problems[0]?.reason).toContain("not set");
    expect(getProduct).not.toHaveBeenCalledWith("");
  });

  it("reports every bad product, not just the first", async () => {
    const { adapter } = fakeProvider([]);

    const problems = await verifyDemoProducts(adapter, demoProductsFor("polar", POLAR_ENV));

    expect(problems.map((p) => p.variable)).toHaveLength(6);
  });

  it("keeps going and does not echo the provider's message when a lookup throws", async () => {
    const adapter = {
      getProduct: vi.fn(async (id: string) => {
        if (id === "id-basic-year") {
          throw new Error("401 Bearer polar_oat_SECRET_TOKEN rejected");
        }
        return GOOD_CATALOG.find((p) => p.id === id) ?? null;
      }),
    } as Pick<PaymentProviderAdapter, "getProduct">;

    const problems = await verifyDemoProducts(adapter, demoProductsFor("polar", POLAR_ENV));

    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ variable: "POLAR_BASIC_YEARLY_PRODUCT_ID" });
    expect(JSON.stringify(problems)).not.toContain("SECRET_TOKEN");
  });
});

describe("assertDemoProducts", () => {
  it("resolves when everything matches", async () => {
    const { adapter } = fakeProvider(GOOD_CATALOG);

    await expect(
      assertDemoProducts(adapter, demoProductsFor("polar", POLAR_ENV)),
    ).resolves.toBeUndefined();
  });

  it("throws an error that names the variable and the id of a missing product", async () => {
    const { adapter } = fakeProvider(GOOD_CATALOG.filter((p) => p.id !== "id-basic-month"));

    const failure = await assertDemoProducts(adapter, demoProductsFor("polar", POLAR_ENV)).catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(DemoProductCheckError);
    expect((failure as Error).message).toContain("POLAR_BASIC_MONTHLY_PRODUCT_ID");
    expect((failure as Error).message).toContain("id-basic-month");
  });
});
