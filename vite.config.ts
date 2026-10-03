import { defineConfig } from "vite-plus";

export default defineConfig({
  lint: {
    rules: {
      // Generated/vendored shadcn components and React hook deps are noisy
      // under the strict default rule set; mirror the ignores Beztack carried
      // in its Biome config so the migration is behaviour-neutral.
      "react-hooks/exhaustive-deps": "off",
    },
    ignorePatterns: [
      "**/components/ui/*.tsx",
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/.output/**",
      "**/.nitro/**",
      "**/auth-schema.generated.ts",
    ],
  },
  staged: {
    "*.{js,jsx,ts,tsx,json,jsonc,css,scss,md,mdx}": "vp check --fix",
  },
});
