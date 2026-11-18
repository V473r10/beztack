import { expect, it, vi } from "vitest";

vi.mock("@/env", () => ({
  env: { VITE_API_URL: "https://api.example.test", VITE_PAYMENT_PROVIDER: "none" },
}));

import { authClient } from "./auth-client";

it("requests a magic link through the auth client", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(
    async () =>
      new Response(JSON.stringify({ status: true }), {
        headers: { "content-type": "application/json" },
      }),
  );

  const result = await authClient.signIn.magicLink({
    email: "visitor@example.test",
    fetchOptions: { customFetchImpl: fetch },
  });

  expect(result.error).toBeNull();
  const [url, options] = fetch.mock.calls[0]!;
  expect(String(url)).toBe("https://api.example.test/api/auth/sign-in/magic-link");
  expect(options?.method).toBe("POST");
  expect(options?.credentials).toBe("include");
  expect(JSON.parse(String(options?.body))).toEqual({ email: "visitor@example.test" });
});
