# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Beztack is an Nx monorepo (pnpm) — a production-ready TypeScript starter for shipping apps fast. Three apps, shared packages, provider-agnostic payments.

## Commands

### Development
```bash
pnpm dev                    # Start all services in parallel
nx dev ui                   # React frontend only
nx dev api                  # Nitro backend only
nx dev docs                 # Next.js docs site only
```

### Build & Quality
```bash
pnpm build                  # Build all apps
nx build <project>          # Build specific project
pnpm dlx ultracite fix      # Format and auto-fix code (Biome)
pnpm dlx ultracite check    # Check for issues without fixing
```

### Testing
```bash
pnpm test                   # Run all tests via Nx
vitest                      # Watch mode (in package dir)
vitest run path/to/file.test.ts   # Run single test file
vitest run -t "test name"         # Run tests matching name
```

### Database
```bash
pnpm migrate                # Generate and apply Drizzle migrations
pnpm push                   # Push schema changes directly (dev shortcut)
pnpm generate-auth-schema   # Regenerate Better Auth schema types
```

### Package Management
```bash
pnpm add <package> --filter @beztack/ui    # Add to frontend
pnpm add <package> --filter @beztack/api   # Add to backend
pnpm add <package> --filter @beztack/db    # Add to database package
```

## Architecture

```
apps/
├── ui/          # Frontend SPA (Vite + React 19)
├── api/         # Backend Server (Nitro/h3)
└── docs/        # Landing & Documentation (Next.js + Fumadocs)

packages/
├── ai/          # AI SDK (Vercel AI + Amazon Bedrock)
├── cli/         # CLI tool for project scaffolding
├── db/          # Database schema, client, migrations (Drizzle + PostgreSQL)
├── email/       # Email templates (React Email + Resend)
├── env/         # Centralized env validation (T3 Env + Zod)
├── ocr/         # OCR utilities (Tesseract.js)
├── payments/
│   ├── core/    # Provider-agnostic types and PaymentProviderAdapter interface
│   ├── polar/   # Polar payment provider (@beztack/payments-polar)
│   └── mercado-pago/  # MercadoPago provider (@beztack/mercadopago)
└── state/       # URL state management (nuqs)
```

### Frontend (`@beztack/ui`)
- React 19 + Vite + Tailwind CSS v4 + shadcn/ui (Radix UI primitives)
- TanStack Query for server state, React Hook Form + Zod for forms
- React Router v7, i18next for i18n, Motion for animations
- Better Auth client for authentication

### Backend (`@beztack/api`)
- Nitro (h3) with file-based routing and auto-imports
- API routes in `apps/api/server/routes/` (e.g., `api/subscriptions/checkout.post.ts`)
- Server utilities in `apps/api/server/utils/` (auth, membership, mercadopago, etc.)
- App-level payment logic in `apps/api/lib/payments/`
- Environment config via `@beztack/env` with `@/env` alias

### Database (`@beztack/db`)
- Schema at `packages/db/src/schema.ts` — shared across apps
- Drizzle config at `packages/db/drizzle.config.ts`
- Client exported from `packages/db/src/client.ts`
- Migrations in `packages/db/drizzle/`

### Payments (multi-provider)
- `@beztack/payments` (core) — provider-agnostic types (`Product`, `Subscription`, `Customer`) and `PaymentProviderAdapter` interface
- `@beztack/payments-polar` — Polar provider, Better Auth plugin via `createPolarAuthPlugin()`
- `@beztack/mercadopago` — MercadoPago provider with server and React integrations
- Apps import types from core; provider selection via `PAYMENT_PROVIDER` env var
- API routes: `/api/subscriptions/*` (unified), `/api/polar/*`, `/api/payments/mercado-pago/*`

### Auth (Better Auth)
- Configured in `apps/api/server/utils/auth.ts`
- Plugins: admin, organization, twoFactor, Polar (conditional on `PAYMENT_PROVIDER`)
- Auth routes at `/api/auth/[...]`
- DB adapter: Drizzle with `@beztack/db`

## Code Style (Biome/Ultracite)

### Formatting
- Double quotes, tabs for indentation, no semicolons (ASI), 80 char line width, trailing commas in multiline

### Import Order
```typescript
// 1) External libs  2) Internal packages  3) Relative imports
import { useState } from "react"
import type { ReactNode } from "react"       // type-only imports
import { db } from "@beztack/db"
import type { User } from "@/types"
import { Button } from "./button"
import { resolve } from "node:path"           // node: protocol for builtins
```

### Naming Conventions
| Element | Convention | Example |
|---------|------------|---------|
| Components | PascalCase | `UserProfile.tsx` |
| Functions/variables | camelCase | `getUserData()` |
| Types | PascalCase | `type UserProps` |
| Constants | UPPER_SNAKE | `const MAX_RETRIES` |
| DB columns | snake_case | `created_at` |
| Files | kebab-case | `user-profile.tsx` |

### TypeScript
- Union types over enums: `type Status = "active" | "inactive"`
- `as const` for literal types, `import type` / `export type` for types
- Avoid: `any`, enums, non-null assertions (`!`), `@ts-ignore`
- Use: `unknown` + type guards, optional chaining, `for...of` over `.forEach()`

### h3 API Route Pattern
```typescript
import { createError, defineEventHandler, readBody } from "h3"
import { z } from "zod"

const schema = z.object({ email: z.string().email() })

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const data = schema.parse(body)
  return { success: true, data }
})
```

### Lefthook
Pre-commit hooks run `ultracite fix` on staged files via lint-staged. Fix linting issues before committing.
