import { resolve } from "node:path";
import { defineNitroConfig } from "nitropack/config";

// https://nitro.build/config
export default defineNitroConfig({
  compatibilityDate: "latest",
  srcDir: "server",
  imports: false,
  alias: {
    "@": resolve(__dirname, "."),
    server: resolve(__dirname, "server"),
  },
  devServer: {
    watch: ["server/**/*"],
  },
  sourceMap: true,
  typescript: {
    generateTsConfig: false,
  },
  experimental: {
    openAPI: true,
  },
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  rollupConfig: {
    external: [
      // Don't externalize these packages - bundle them instead
      // This prevents ESM resolution issues in Vercel
    ],
    plugins: [],
  },
  // Bundle all dependencies to avoid ESM resolution issues in Vercel
  bundledDependencies: [
    "@polar-sh/sdk",
    "@polar-sh/better-auth",
    "better-auth",
  ],
  // Ensure proper node compatibility
  node: true,
  // Build configuration for serverless environments
  nitro: {
    bundleAnalyze: process.env.BUNDLE_ANALYZE === "true",
  },
});
