# Beztack - Agent Guidelines

## Project Overview

Nx monorepo using pnpm. Stack: React 19 + Vite (frontend), Nitro/h3 (API), PostgreSQL + Drizzle ORM, Better Auth, Tailwind CSS v4.

```
apps/ui/       # React 19 SPA with Vite, TanStack Query, Radix UI
apps/api/      # Nitro server with PostgreSQL, Drizzle ORM, Better Auth
apps/docs/     # Next.js 16 documentation site with Fumadocs
packages/      # Shared packages: ai, cli, email, env, ocr, state
```

## Commands

### Development
```bash
pnpm dev                    # Start all services in parallel
nx dev ui                   # Start React frontend only
nx dev api                  # Start Nitro backend only
```

### Build & Lint
```bash
pnpm build                  # Build all apps
nx build <project>          # Build specific project
pnpm dlx ultracite fix      # Format and auto-fix code
pnpm dlx ultracite check    # Check for issues without fixing
```

### Testing
```bash
pnpm test                   # Run all tests via Nx
vitest                      # Run tests in watch mode (in package dir)
vitest run                  # Run tests once
vitest run path/to/file.test.ts           # Run single test file
vitest run -t "test name"                 # Run tests matching name
```

### Database
```bash
pnpm migrate                # Generate and apply migrations
pnpm push                   # Push schema changes directly
```

### Package Management
```bash
pnpm add <package> --filter @beztack/ui   # Add to frontend
pnpm add <package> --filter @beztack/api  # Add to backend
```

## Code Style

### Imports
```typescript
// Order: 1) external libs, 2) internal packages, 3) relative imports
// Use type-only imports for types
import { useState } from "react";
import type { ReactNode } from "react";
import { db } from "@beztack/db";
import type { User } from "@/types";
import { Button } from "./button";

// Use node: protocol for Node.js builtins
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
```

### Formatting (Biome/Ultracite)
- Double quotes for strings
- Tabs for indentation
- No semicolons (ASI)
- 80 character line width
- Trailing commas in multiline

### TypeScript
```typescript
// Use union types, NOT enums
type Status = "active" | "inactive" | "pending"

// Use `as const` for literal types
const ROLES = ["admin", "user", "guest"] as const
type Role = (typeof ROLES)[number]

// Use `import type` and `export type` for types
import type { User } from "./types"
export type { User }

// Avoid: any, enums, non-null assertions (!), @ts-ignore
// Use: unknown + type guards, union types, optional chaining
```

### Naming Conventions
| Element | Convention | Example |
|---------|------------|---------|
| Components | PascalCase | `UserProfile.tsx` |
| Functions/variables | camelCase | `getUserData()` |
| Types/Interfaces | PascalCase | `type UserProps` |
| Constants | UPPER_SNAKE | `const MAX_RETRIES` |
| DB columns | snake_case | `created_at` |
| Files | kebab-case | `user-profile.tsx` |

### Error Handling
```typescript
// API routes: use h3's createError with Zod validation
import { createError, defineEventHandler, readBody } from "h3"
import { z } from "zod"

const schema = z.object({ email: z.string().email() })

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const data = schema.parse(body)
    return { success: true, data }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw createError({ statusCode: 400, message: "Invalid input" })
    }
    throw createError({ statusCode: 500, message: "Internal error" })
  }
})
```

### React Patterns
```typescript
// Functional components with typed props
interface ButtonProps {
  children: ReactNode
  onClick?: () => void
  variant?: "primary" | "secondary"
}

export function Button({ children, onClick, variant = "primary" }: ButtonProps) {
  return (
    <button type="button" onClick={onClick} className={cn("btn", variant)}>
      {children}
    </button>
  )
}

// Hooks: complete dependency arrays, cleanup effects
// No components defined inside other components
// Use React Query for server state, useState for local state
```

### Database Schema (Drizzle)
```typescript
import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core"

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})
```

## Key Rules

### Must Follow
- Use `for...of` instead of `Array.forEach()`
- Use `===` and `!==` for comparisons
- Use `const` by default, `let` only when reassignment needed
- Use arrow functions over function expressions
- Use optional chaining (`?.`) over logical AND chains
- Use template literals over string concatenation
- Include `type` attribute on all `<button>` elements
- Include `key` prop in list iterations (not array index)
- Handle all promises (no floating promises)
- No unused variables, imports, or parameters

### Accessibility
- All images need meaningful `alt` text
- All form inputs need associated labels
- Interactive elements must be keyboard accessible
- No positive `tabIndex` values
- Use semantic HTML elements over ARIA roles

### Forbidden
- `var` declarations
- `any` type
- TypeScript enums (use union types)
- `@ts-ignore` directive
- `eval()` or `new Function()`
- `console.log` in production code
- Hardcoded secrets/API keys

## File Organization

- Server utilities: `apps/api/server/utils/`
- React hooks: `apps/ui/src/hooks/`
- Shared components: `apps/ui/src/components/`
- Database schema: `apps/api/db/schema.ts`
- Environment config: `packages/env/`

Always prefer editing existing files over creating new ones.
