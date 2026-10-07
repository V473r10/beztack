import { resolve } from "node:path";
import { defineConfig } from "vite-plus";

const packages = resolve(import.meta.dirname, "../../packages");

/**
 * Test-runner configuration for the Nitro API.
 *
 * The API is built by Nitro (rollup), which reads its own `alias` map from
 * `nitro.config.ts` and never looks at this file. That leaves `vp test` with no
 * alias resolution of its own: any `@/...` or workspace import reached from a
 * module under test would otherwise escape to Node's ESM resolver.
 *
 * The `@`/`server` aliases mirror `nitro.config.ts` (keep them in sync). The
 * workspace aliases resolve packages that publish built `dist/` to their source
 * instead, so tests run against source without a prior package build. Packages
 * that already export source (e.g. @beztack/db) need no entry here.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "."),
      server: resolve(import.meta.dirname, "server"),
      "@beztack/payments/subscription": resolve(packages, "payments/core/src/subscription.ts"),
      "@beztack/payments": resolve(packages, "payments/core/src/index.ts"),
      "@beztack/mercadopago/server": resolve(packages, "payments/mercado-pago/src/server/index.ts"),
      "@beztack/mercadopago": resolve(packages, "payments/mercado-pago/src/index.ts"),
      "@beztack/payments-polar/auth": resolve(packages, "payments/polar/src/auth-plugin.ts"),
      "@beztack/payments-polar": resolve(packages, "payments/polar/src/index.ts"),
      "@beztack/email": resolve(packages, "email/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "server/**/*.test.tsx"],
  },
});
