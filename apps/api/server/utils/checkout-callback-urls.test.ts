import { describe, expect, it } from "vitest";
import { resolveCheckoutCallbackUrls } from "./checkout-callback-urls";

describe("checkout callback URLs", () => {
  it("use server configuration instead of request overrides", () => {
    const urls = resolveCheckoutCallbackUrls({
      configuredSuccessUrl: "https://app.example.com/checkout-success",
      configuredCancelUrl: "https://app.example.com/pricing?checkout=canceled",
      requestSuccessUrl: "http://localhost:5173/checkout-success",
      requestCancelUrl: "http://localhost:5173/pricing?checkout=canceled",
    });

    expect(urls).toEqual({
      successUrl: "https://app.example.com/checkout-success",
      cancelUrl: "https://app.example.com/pricing?checkout=canceled",
    });
  });
});
