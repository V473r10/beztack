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

# Non-interactive mode (CI/scripts)
pnpm dlx beztack create --yes --name my-app --no-install --no-git --no-init

# Use a local template source (useful for offline tests)
pnpm dlx beztack create --yes --name my-app --template-source ../beztack
```

### Configure modules in existing project

```bash
pnpm dlx beztack init
```

### Show help

```bash
pnpm dlx beztack help
```

### Template sync

```bash
pnpm dlx beztack template status
pnpm dlx beztack template plan --to 1.2.0
pnpm dlx beztack template apply --dry-run
pnpm dlx beztack template rollback --snapshot <id>
pnpm dlx beztack template inspect --port 3434
```

Template cache flags:

- `--refresh`: force refresh of local template cache
- `--offline`: use local template cache only
- `--host <host>`: host for `template inspect` local server
- `--port <port>`: port for `template inspect` local server

Template diff normalization ignores scaffold-only differences such as:

- app name/APP_NAME substitutions
- root `package.json` bootstrap fields (`name`, `description`)
- `pnpm-lock.yaml` importer block for `scripts/create-beztack`

## Commands

| Command | Description |
|---------|-------------|
| `create` | Create a new Beztack project (default) |
| `init` | Configure modules in an existing project |
| `template` | Run template status/plan/apply/rollback commands |
| `help` | Show help message |

### `create` non-interactive flags

| Flag | Description |
|------|-------------|
| `--yes` | Enables non-interactive mode and uses defaults for missing values |
| `--non-interactive` | Enables non-interactive mode |
| `--name <project-name>` | Sets project name |
| `--description <text>` | Sets project description |
| `--git` / `--no-git` | Enable/disable git initialization |
| `--install` / `--no-install` | Enable/disable dependency installation |
| `--init` / `--no-init` | Enable/disable module configuration |
| `--template-source <path-or-url>` | Clone template from a custom git source |

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

## Manual testing sandbox

For manual CLI/template-sync validation in this repository, use
`.beztack-sandbox/`.

This directory is excluded from git and from template-sync diff/snapshot
scans to avoid polluting update plans.

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
