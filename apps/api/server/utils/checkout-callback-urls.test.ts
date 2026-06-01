import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveCheckoutCallbackUrls } from "./checkout-callback-urls";

test("checkout callback URLs use server configuration instead of request overrides", () => {
  const urls = resolveCheckoutCallbackUrls({
    configuredSuccessUrl: "https://app.example.com/checkout-success",
    configuredCancelUrl: "https://app.example.com/pricing?checkout=canceled",
    requestSuccessUrl: "http://localhost:5173/checkout-success",
    requestCancelUrl: "http://localhost:5173/pricing?checkout=canceled",
  });

  assert.deepEqual(urls, {
    successUrl: "https://app.example.com/checkout-success",
    cancelUrl: "https://app.example.com/pricing?checkout=canceled",
  });
});
