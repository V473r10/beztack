# @beztack/env

Centralized T3 Env configuration package for the Beztack monorepo.

## Overview

This package provides type-safe, validated environment variable configurations for all applications in the monorepo. It uses [@t3-oss/env-core](https://env.t3.gg/) and [@t3-oss/env-nextjs](https://env.t3.gg/) under the hood to provide runtime validation and TypeScript type safety.

## Features

- ✅ **Type-safe**: Full TypeScript support with autocomplete
- ✅ **Validated at build time**: Fails fast if required env vars are missing
- ✅ **Centralized**: Single source of truth for all env configurations
- ✅ **Framework-specific**: Optimized for Nitro, Vite, and Next.js
- ✅ **Zero-config**: Works out of the box with sensible defaults

## Modules

### API (Nitro/Node.js)

For server-side applications using Nitro or Node.js:

```typescript
import { env } from "@beztack/env/api";

// Access validated environment variables
const dbUrl = env.DATABASE_URL;
const authSecret = env.BETTER_AUTH_SECRET;
```

**Available variables:**
- Database: `DATABASE_URL`
- Auth: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `APP_NAME`
- Polar: Multiple product IDs and configuration
- Resend: Email service configuration
- Node: `NODE_ENV`

### UI (Vite)

For client-side applications using Vite:

```typescript
import { env } from "@beztack/env/ui";

// Access validated client-side environment variables
const apiUrl = env.VITE_API_URL;
const basePath = env.VITE_BASE_PATH;
```

**Available variables:**
- `VITE_API_URL`: API server URL (default: http://localhost:3000)
- `VITE_BASE_PATH`: Application base path (default: /)

### Next.js

For Next.js applications:

```typescript
import { env } from "@beztack/env/nextjs";

// Access validated environment variables
const nodeEnv = env.NODE_ENV;
```

**Available variables:**
- `NODE_ENV`: Node environment (development/production/test)

## Usage in Applications

### apps/api

```typescript
// apps/api/env.ts
export { env } from "@beztack/env/api";
```

### apps/ui

```typescript
// apps/ui/src/env.ts
export { env } from "@beztack/env/ui";
```

### apps/landing & apps/docs

```typescript
// apps/landing/env.ts or apps/docs/env.ts
export { env } from "@beztack/env/nextjs";
```

## Adding New Environment Variables

### For API (Server-side)

Edit `packages/env/src/api.ts` and add your variable to the `server` object:

```typescript
server: {
  // ...existing variables
  MY_NEW_VAR: z.string().min(1),
}
```

### For UI (Client-side)

Edit `packages/env/src/ui.ts` and add your variable to the `client` object:

```typescript
client: {
  // ...existing variables
  VITE_MY_NEW_VAR: z.string().min(1),
}
```

**Important**: Client-side variables in Vite MUST be prefixed with `VITE_`.

### For Next.js

Edit `packages/env/src/nextjs.ts` and add your variable to either `server` or `client`:

```typescript
server: {
  MY_SERVER_VAR: z.string().min(1),
},
client: {
  NEXT_PUBLIC_MY_CLIENT_VAR: z.string().min(1),
}
```

**Important**: Client-side variables in Next.js MUST be prefixed with `NEXT_PUBLIC_`.

## Validation

Environment variables are validated at build time. If any required variable is missing or invalid, the build will fail with a clear error message.

### Example Error:

```
❌ Invalid environment variables:
{
  DATABASE_URL: [ 'Required' ]
}
```

## Development

### Building the package

```bash
cd packages/env
pnpm build
```

### Watching for changes

```bash
cd packages/env
pnpm dev
```

## TypeScript Support

The package is fully typed and provides excellent IntelliSense support. All environment variables are strictly typed based on their Zod schema.

## Dependencies

- `@t3-oss/env-core`: Core validation library
- `@t3-oss/env-nextjs`: Next.js-specific utilities
- `zod`: Schema validation

## License

MIT
