export type AppName = "api" | "ui" | "docs";

export interface ModuleDefinition {
  name: string; // 'auth', 'payments', etc.
  label: string; // Texto amigable para la UI
  description?: string; // Texto corto para la UI
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
    description: "Payment processing with Polar",
    required: false,
    nxProjects: ["api", "ui"],
    hasApiModule: true,
    hasUiFeature: true,
    npmDeps: ["@polar-sh/sdk", "@polar-sh/better-auth"],
    fileGlobs: [
      "apps/api/server/modules/payments/**/*",
      "apps/api/server/routes/api/polar/**/*",
      "apps/ui/src/features/payments/**/*",
      "apps/ui/src/app/billing/**/*",
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
