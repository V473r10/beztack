import { defineConfig } from "vite-plus";

export default defineConfig({
  lint: {
    plugins: ["react", "typescript", "unicorn", "oxc"],
    rules: {
      // Generated/vendored shadcn components and React hook deps are noisy
      // under the strict default rule set; mirror the ignores Beztack carried
      // in its Biome config so the migration is behaviour-neutral.
      "react-hooks/exhaustive-deps": "off",
      // User-visible text must go through i18n. Warn-only until the hardcoded
      // strings outside the demo path are translated.
      "react/jsx-no-literals": "warn",
      // Opt-in module shape (AGENTS.md): nothing outside a domain module
      // imports its internal/ folder. Inside the module, `./internal/...`
      // does not match these patterns.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/server/domain/*/internal",
                "@/server/domain/*/internal/**",
                "**/domain/*/internal",
                "**/domain/*/internal/**",
              ],
              message: "Import the domain module's directory, not its internal/ files.",
            },
          ],
        },
      ],
    },
    overrides: [
      {
        // The demo path (BZ-124) is fully translated: a literal here is a bug, not a warning.
        files: [
          "apps/ui/src/app/auth/**",
          "apps/ui/src/app/billing/**",
          "apps/ui/src/app/home/**",
          "apps/ui/src/app/organizations/**",
          "apps/ui/src/app/invitations/**",
          "apps/ui/src/components/organizations/**",
          "apps/ui/src/components/payments/*.tsx",
          "apps/ui/src/components/{demo-banner,app-sidebar,nav-main,nav-secondary,nav-user,site-header,pricing-bar,admin-tier-override-banner,command-palette,tour}.tsx",
        ],
        rules: { "react/jsx-no-literals": "error" },
      },
    ],
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
