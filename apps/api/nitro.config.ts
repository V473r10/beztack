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
    external: [],
    plugins: [],
  },
});
