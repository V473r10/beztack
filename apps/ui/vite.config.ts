import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, loadEnv, type Plugin } from "vite";

/**
 * Validate the UI env schema (fails fast when e.g. VITE_DEFAULT_CURRENCY is
 * missing) for dev and build. The test runner (mode "test") skips it: tests
 * mock `@/env` and must not depend on a local .env file.
 */
function validateUiEnv(): Plugin {
  return {
    name: "beztack:validate-ui-env",
    async configResolved(config) {
      if (config.mode === "test") {
        return;
      }
      // The schema reads process.env here (there is no import.meta.env in the
      // config), so expose the .env file values to it first. Real environment
      // variables still win, as in loadEnv.
      for (const [name, value] of Object.entries(
        loadEnv(config.mode, config.envDir || process.cwd(), ""),
      )) {
        process.env[name] ??= value;
      }
      // Import the package directly: a local re-export would be inlined by the
      // config bundler and hoisted to a static import, defeating the guard.
      await import("@beztack/env/ui");
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const base = env.VITE_BASE_PATH || "/";

  return {
    base,
    plugins: [
      react({
        jsxImportSource: "react",
      }),
      tailwindcss(),
      validateUiEnv(),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom"],
    },
    build: {
      sourcemap: true,
      minify: false,
    },
    server: {
      port: 5173,
      host: true,
      hmr: {
        overlay: false,
      },
    },
    esbuild: {
      sourcemap: "inline",
      keepNames: true,
      minifyIdentifiers: false,
      minifySyntax: false,
    },
    optimizeDeps: {
      force: true,
      include: ["react", "react-dom", "@beztack/state"],
      exclude: [],
    },
    css: {
      devSourcemap: true,
    },
  };
});
