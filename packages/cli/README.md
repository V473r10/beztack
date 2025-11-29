# beztack

CLI to create and configure Beztack monorepo projects.

## Features

- 🚀 **Project scaffolding**: Create new Beztack projects from template
- 🎯 **Optional modules**: Select only the modules you need
- �️ **Interactive UI**: Beautiful CLI interface with `@clack/prompts`
- 🧹 **Auto cleanup**: Removes unused dependencies, files, and code
- 🔄 **Codemods**: Automatically updates imports and references
- 📦 **Smart install**: Single `pnpm install` at the end

## Usage

### Create a new project

```bash
# Using pnpm create (recommended)
pnpm create beztack

# Or directly with the CLI
pnpm dlx beztack create
```

### Configure modules in existing project

```bash
pnpm dlx beztack init
```

### Show help

```bash
pnpm dlx beztack help
```

## Commands

| Command | Description |
|---------|-------------|
| `create` | Create a new Beztack project (default) |
| `init` | Configure modules in an existing project |
| `help` | Show help message |

## Available Modules

| Module | Required | Description |
|--------|----------|-------------|
| **auth** | ✅ | Authentication with Better Auth |
| **payments** | ❌ | Payment processing with Polar |
| **email** | ❌ | Email sending with Resend and React Email |
| **ai** | ❌ | AI integration with Vercel AI SDK |
| **ocr** | ❌ | Optical Character Recognition with Tesseract.js |
| **state** | ❌ | URL state management with nuqs |

## How it works

### `beztack create`

1. Prompts for project name and configuration
2. Clones the Beztack template repository
3. Customizes project files with your settings
4. Installs dependencies
5. Runs `beztack init` to configure modules
6. Initializes Git repository (optional)

### `beztack init`

1. Shows interactive module selector
2. Removes unselected modules:
   - Deletes package directories
   - Cleans dependencies from package.json
   - Removes related files
   - Runs codemods to clean imports
3. Regenerates entrypoints (routes, API modules)
4. Runs `pnpm install` once

## Development

```bash
# Build
pnpm build

# Watch mode
pnpm dev

# Type check
pnpm typecheck
```

## Project Structure

```
src/
├── cli.ts                    # CLI entry point with commands
├── create.ts                 # Project creation logic
├── index.ts                  # Public exports
├── modules.ts                # Module definitions
├── init-project.ts           # Module initialization logic
├── remove-module.ts          # Module removal logic
├── generate-entrypoints.ts   # Entrypoint file generation
├── utils/
│   ├── workspace.ts          # Workspace utilities
│   ├── remove-deps.ts        # Dependency cleanup
│   └── get-nx-project-roots.ts # Nx project detection
└── codemods/
    ├── shared.ts             # Shared utilities
    └── remove-*-imports.ts   # Module-specific codemods
```

## Adding a New Module

1. Add definition in `src/modules.ts`:

```typescript
{
  name: "my-module",
  label: "My Module",
  description: "Short description",
  required: false,
  packageDir: "packages/my-module",
  npmDeps: ["@beztack/my-module"],
  nxProjects: ["api", "ui"],
  hasApiModule: true,
  hasUiFeature: true,
  fileGlobs: [
    "apps/api/server/modules/my-module/**/*",
    "apps/ui/src/features/my-module/**/*",
  ],
  codemods: ["remove-my-module-imports"],
}
```

2. Create codemod in `src/codemods/remove-my-module-imports.ts`:

```typescript
import { removeImportsForPackage } from "./shared.js";

export async function run() {
  await removeImportsForPackage("@beztack/my-module");
}
```

3. Create module files:
   - `apps/api/server/modules/my-module/index.ts`
   - `apps/ui/src/features/my-module/routes.tsx`

## License

MIT
