import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react({
    // Força sourcemaps consistentes para React
    jsxImportSource: "react"
  }), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    sourcemap: true,
    minify: false, // Desabilita minificación em dev para sourcemaps
  },
  server: {
    port: 5173,
    host: true,
    hmr: {
      overlay: false
    }
  },
  esbuild: {
    sourcemap: 'inline', // Sourcemaps inline são mais estáveis
    keepNames: true,
    minifyIdentifiers: false,
    minifySyntax: false,
  },
  // Configuração crucial para debugging consistente
  optimizeDeps: {
    force: false, // Evita rebuilds desnecessários
    include: ["react", "react-dom"]
  },
  css: {
    devSourcemap: true
  }
})
