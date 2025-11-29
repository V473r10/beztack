# @beztack/init

CLI para inicializar y configurar módulos opcionales en proyectos Beztack.

## Características

- 🎯 **Sistema de módulos opcionales**: Selecciona solo los módulos que necesitas
- 🚀 **Interactivo**: Interfaz CLI con `@clack/prompts` para selección visual
- 🧹 **Limpieza automática**: Remueve dependencias, archivos y código innecesario
- 🔄 **Codemods**: Actualiza automáticamente imports y referencias
- 📦 **Gestión inteligente**: Un solo `pnpm install` al final

## Uso

Este paquete se ejecuta automáticamente cuando creas un nuevo proyecto con `create-beztack`:

```bash
pnpm create beztack
```

O puedes ejecutarlo manualmente en un proyecto existente:

```bash
npx beztack-init
```

## Módulos disponibles

- **auth** (obligatorio): Sistema de autenticación con Better Auth
- **payments**: Integración de pagos con Mercado Pago
- **email**: Envío de emails con Resend y React Email
- **ai**: Integración con OpenAI y otros LLMs
- **ocr**: Reconocimiento óptico de caracteres con Tesseract
- **state**: Manejo de estado en URL con nuqs

## Cómo funciona

1. Muestra un selector interactivo de módulos opcionales
2. Remueve los módulos no seleccionados:
   - Elimina carpetas de packages
   - Limpia dependencias de package.json
   - Borra archivos relacionados
   - Ejecuta codemods para limpiar imports
3. Regenera entrypoints (routes, módulos API)
4. Ejecuta `pnpm install` una sola vez

## Desarrollo

```bash
# Build
pnpm build

# Watch mode
pnpm dev

# Type check
pnpm typecheck
```

## Estructura

```
src/
├── cli.ts                    # Entry point del CLI
├── index.ts                  # Exports públicos
├── modules.ts                # Definición de módulos
├── init-project.ts           # Lógica principal
├── remove-module.ts          # Remoción de módulos
├── generate-entrypoints.ts   # Generación de archivos
├── utils/
│   ├── workspace.ts          # Utilidades de workspace
│   ├── remove-deps.ts        # Limpieza de dependencias
│   └── get-nx-project-roots.ts # Detección de proyectos Nx
└── codemods/
    ├── shared.ts             # Utilidades compartidas
    └── remove-*-imports.ts   # Codemods específicos
```

## Agregar nuevo módulo

1. Agregar definición en `src/modules.ts`:

```typescript
{
  name: "mi-modulo",
  label: "Mi Módulo",
  description: "Descripción breve",
  required: false,
  packageDir: "packages/mi-modulo",
  npmDeps: ["@beztack/mi-modulo"],
  nxProjects: ["api", "ui"],
  fileGlobs: ["apps/api/server/modules/mi-modulo/**/*"],
  codemods: ["remove-mi-modulo-imports"],
}
```

2. Crear codemod en `src/codemods/remove-mi-modulo-imports.ts`:

```typescript
import { removeImportsForPackage } from "./shared.js";

export async function run() {
  await removeImportsForPackage("@beztack/mi-modulo");
}
```

## Licencia

MIT
