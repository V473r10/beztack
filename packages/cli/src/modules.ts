export type AppName = "api" | "ui" | "docs";
export type PaymentProvider = "polar" | "mercadopago";

export interface ModuleDefinition {
  name: string; // 'auth', 'payments', etc.
  label: string; // User-friendly text for the UI
  description?: string; // Short description for the UI
  required: boolean;
  packageDir?: string; // 'packages/email' - if removed, module is disabled
  npmDeps?: string[]; // deps to remove from package.json
  nxProjects?: string[]; // Nx projects affected
  fileGlobs?: string[]; // files to delete when removing module
  codemods?: string[]; // codemods to execute
  hasApiModule?: boolean; // has apps/api/server/modules/{name}/
  hasUiFeature?: boolean; // has apps/ui/src/features/{name}/
}

export const modules: ModuleDefinition[] = [
  {
    name: "auth",
    label: "Auth (required)",
    description: "Core authentication with Better Auth",
    required: true,
    nxProjects: ["api", "ui"],
    hasApiModule: true,
    hasUiFeature: true,
    fileGlobs: [
      "apps/api/server/modules/auth/**/*",
      "apps/api/server/routes/api/auth/**/*",
      "apps/ui/src/features/auth/**/*",
      "apps/ui/src/app/auth/**/*",
    ],
  },
  {
    name: "payments",
    label: "Payments",
    description: "Payment processing (Polar or Mercado Pago)",
    required: false,
    nxProjects: ["api", "ui"],
    hasApiModule: true,
    hasUiFeature: true,
    npmDeps: [
      "@polar-sh/sdk",
      "@polar-sh/better-auth",
      "@beztack/mercadopago",
      "@mercadopago/sdk-react",
      "mercadopago",
    ],
    fileGlobs: [
      "apps/api/server/modules/payments/**/*",
      "apps/api/server/routes/api/subscriptions/**/*",
      "apps/api/server/routes/api/polar/**/*",
      "apps/api/server/routes/api/payments/mercado-pago/**/*",
      "apps/api/lib/payments/**/*",
      "apps/api/lib/webhooks.ts",
      "apps/api/server/utils/mercadopago.ts",
      "apps/api/server/utils/payment-events.ts",
      "apps/ui/src/features/payments/**/*",
      "apps/ui/src/app/billing/**/*",
      "apps/ui/src/components/payments/**/*",
      "apps/ui/src/contexts/membership-context.tsx",
      "apps/ui/src/hooks/use-subscriptions.ts",
      "apps/ui/src/hooks/use-polar-products.tsx",
      "apps/ui/src/hooks/use-subscription-details.ts",
      "apps/ui/src/hooks/use-payment-events.ts",
      "apps/ui/src/types/membership.ts",
      "apps/ui/src/types/polar-pricing.ts",
      "apps/ui/src/app/examples/mercado-pago-demo.tsx",
    ],
    codemods: ["remove-payments-imports"],
  },
  {
    name: "email",
    label: "Email",
    description: "Email sending with React Email and Resend",
    required: false,
    packageDir: "packages/email",
    npmDeps: ["@beztack/email", "resend", "@react-email/components"],
    nxProjects: ["api"],
    hasApiModule: true,
    hasUiFeature: false,
    fileGlobs: [
      "apps/api/server/modules/email/**/*",
      "apps/api/server/routes/api/email/**/*",
    ],
    codemods: ["remove-email-imports"],
  },
  {
    name: "ai",
    label: "AI",
    description: "AI integration with Vercel AI SDK",
    required: false,
    packageDir: "packages/ai",
    npmDeps: ["@beztack/ai", "ai"],
    nxProjects: ["api", "ui"],
    hasApiModule: true,
    hasUiFeature: true,
    fileGlobs: [
      "apps/api/server/modules/ai/**/*",
      "apps/ui/src/features/ai/**/*",
      "apps/ui/src/app/ai/**/*",
    ],
    codemods: ["remove-ai-imports"],
  },
  {
    name: "ocr",
    label: "OCR",
    description: "Optical Character Recognition with Tesseract.js",
    required: false,
    packageDir: "packages/ocr",
    npmDeps: ["@beztack/ocr", "tesseract.js"],
    nxProjects: ["api", "ui"],
    hasApiModule: true,
    hasUiFeature: true,
    fileGlobs: [
      "apps/api/server/modules/ocr/**/*",
      "apps/ui/src/features/ocr/**/*",
      "apps/ui/src/app/ocr/**/*",
    ],
    codemods: ["remove-ocr-imports"],
  },
  {
    name: "state",
    label: "State Management",
    description: "URL state management with nuqs",
    required: false,
    packageDir: "packages/state",
    npmDeps: ["@beztack/state", "nuqs"],
    nxProjects: ["ui", "docs"],
    hasApiModule: false,
    hasUiFeature: true,
    fileGlobs: [
      "apps/ui/src/features/state/**/*",
      "apps/ui/src/app/examples/nuqs-demo.tsx",
    ],
    codemods: ["remove-state-imports"],
  },
];
