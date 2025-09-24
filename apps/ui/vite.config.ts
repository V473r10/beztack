import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, loadEnv } from "vite";

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
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
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
      force: false,
      include: ["react", "react-dom"],
    },
    css: {
      devSourcemap: true,
    },
  };
});
