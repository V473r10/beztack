export type AppName = "api" | "ui" | "docs";

export interface ModuleDefinition {
  name: string; // 'auth', 'storage-s3', etc.
  label: string; // Texto amigable para la UI
  description?: string; // Texto corto para la UI
  required: boolean;
  packageDir?: string; // 'packages/storage-s3'
  npmDeps?: string[]; // deps a quitar de package.json
  nxProjects?: string[]; // proyectos Nx afectados (por nombre)
  fileGlobs?: string[]; // archivos a borrar
  codemods?: string[]; // nombres de codemods a ejecutar
}

export const modules: ModuleDefinition[] = [
  {
    name: "auth",
    label: "Auth (obligatorio)",
    required: true,
    packageDir: "packages/auth",
    npmDeps: ["@beztack/auth"],
    nxProjects: ["api", "ui"],
    fileGlobs: [
      "apps/api/server/modules/auth/**/*",
      "apps/ui/src/features/auth/**/*",
    ],
  },
  {
    name: "payments",
    label: "Payments",
    description: "Sistema de pagos con Mercado Pago",
    required: false,
    packageDir: "packages/payments",
    npmDeps: ["@beztack/payments", "@mercadopago/sdk-react", "mercadopago"],
    nxProjects: ["api", "ui"],
    fileGlobs: [
      "apps/api/server/modules/payments/**/*",
      "apps/ui/src/features/payments/**/*",
    ],
    codemods: ["remove-payments-imports"],
  },
  {
    name: "email",
    label: "Email",
    description: "Envío de emails con templates",
    required: false,
    packageDir: "packages/email",
    npmDeps: ["@beztack/email", "resend", "@react-email/components"],
    nxProjects: ["api"],
    fileGlobs: ["apps/api/server/modules/email/**/*"],
    codemods: ["remove-email-imports"],
  },
  {
    name: "ai",
    label: "AI",
    description: "Integración con OpenAI y otros LLMs",
    required: false,
    packageDir: "packages/ai",
    npmDeps: ["@beztack/ai", "ai", "openai"],
    nxProjects: ["api"],
    fileGlobs: ["apps/api/server/modules/ai/**/*"],
    codemods: ["remove-ai-imports"],
  },
  {
    name: "ocr",
    label: "OCR",
    description: "Reconocimiento óptico de caracteres",
    required: false,
    packageDir: "packages/ocr",
    npmDeps: ["@beztack/ocr", "tesseract.js"],
    nxProjects: ["api"],
    fileGlobs: ["apps/api/server/modules/ocr/**/*"],
    codemods: ["remove-ocr-imports"],
  },
  {
    name: "state",
    label: "State Management",
    description: "Manejo de estado con nuqs",
    required: false,
    packageDir: "packages/state",
    npmDeps: ["@beztack/state", "nuqs"],
    nxProjects: ["ui", "docs"],
    fileGlobs: ["apps/ui/src/features/state/**/*"],
    codemods: ["remove-state-imports"],
  },
];
