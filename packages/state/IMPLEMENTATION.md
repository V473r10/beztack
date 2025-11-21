# @beztack/state - Implementation Guide

## Overview

This package centralizes state management utilities for the Beztack monorepo, starting with nuqs for type-safe URL search params state management.

## Architecture

### Package Structure
```
packages/state/
├── src/
│   ├── index.ts              # Core exports from nuqs
│   └── adapters/
│       ├── react.ts          # React SPA adapter
│       ├── next.ts           # Next.js unified adapter
│       ├── next-app.ts       # Next.js App Router adapter
│       └── next-pages.ts     # Next.js Pages Router adapter
├── package.json
├── tsconfig.json
├── README.md
├── CHANGELOG.md
└── IMPLEMENTATION.md (this file)
```

### Module Exports

The package uses conditional exports to provide framework-specific adapters:

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./adapters/react": "./src/adapters/react.ts",
    "./adapters/next": "./src/adapters/next.ts",
    "./adapters/next/app": "./src/adapters/next-app.ts",
    "./adapters/next/pages": "./src/adapters/next-pages.ts"
  }
}
```

## Implementation Details

### 1. Core Functionality (index.ts)

Re-exports all nuqs functionality with proper TypeScript types:

- **Client Hooks**: `useQueryState`, `useQueryStates`
- **Parsers**: String, Integer, Float, Boolean, Enum, Array, JSON, DateTime, etc.
- **Server Utilities**: `createSearchParamsCache` and server-side parsers
- **Type Definitions**: Full TypeScript support with proper type inference

### 2. Framework Adapters

Each adapter wraps the appropriate nuqs adapter for its framework:

#### React SPA (Vite, CRA)
```tsx
import { NuqsAdapter } from 'nuqs/adapters/react'
export { NuqsAdapter }
```

#### Next.js App Router
```tsx
import { NuqsAdapter } from 'nuqs/adapters/next/app'
export { NuqsAdapter }
```

#### Next.js Pages Router
```tsx
import { NuqsAdapter } from 'nuqs/adapters/next/pages'
export { NuqsAdapter }
```

#### Next.js Unified (both routers)
```tsx
import { NuqsAdapter } from 'nuqs/adapters/next'
export { NuqsAdapter }
```

## Integration with apps/ui

### Setup Steps

1. **Add dependency** in `apps/ui/package.json`:
   ```json
   {
     "dependencies": {
       "@beztack/state": "workspace:*"
     }
   }
   ```

2. **Wrap app** in `apps/ui/src/main.tsx`:
   ```tsx
   import { NuqsAdapter } from '@beztack/state/adapters/react'
   
   createRoot(root).render(
     <StrictMode>
       <NuqsAdapter>
         <App />
       </NuqsAdapter>
     </StrictMode>
   )
   ```

3. **Use in components**:
   ```tsx
   import { useQueryState, parseAsInteger } from '@beztack/state'
   
   function Component() {
     const [page, setPage] = useQueryState(
       'page',
       parseAsInteger.withDefault(1)
     )
     
     return (
       <button onClick={() => setPage(p => p + 1)}>
         Page {page}
       </button>
     )
   }
   ```

## Demo Implementation

A comprehensive demo is available at `/nuqs-demo` showcasing:

### 1. Basic String State
- Simple text input synced with URL
- Clear and set operations

### 2. Number Parser
- Pagination with increment/decrement
- Type-safe integer parsing
- Default values

### 3. Boolean Parser
- Toggle switches
- Checkbox states

### 4. Enum Parser
- Select from predefined options
- Type-safe enum values

### 5. Array Parser
- Multiple tag selection
- Add/remove operations

### 6. Batched Updates
- Multiple params updated atomically
- Range sliders with min/max
- Category filter

## Best Practices

### 1. Always Use Parsers

```tsx
// ✅ Good - Type-safe with parser
const [count, setCount] = useQueryState(
  'count',
  parseAsInteger.withDefault(0)
)

// ❌ Bad - Returns string | null
const [count, setCount] = useQueryState('count')
```

### 2. Provide Default Values

```tsx
// ✅ Good - Never null
const [search, setSearch] = useQueryState('search', {
  defaultValue: ''
})

// ❌ Bad - Can be null
const [search, setSearch] = useQueryState('search')
```

### 3. Use Batched Updates for Multiple Params

```tsx
// ✅ Good - Single URL update
const [filters, setFilters] = useQueryStates({
  min: parseAsInteger.withDefault(0),
  max: parseAsInteger.withDefault(100),
  category: parseAsString.withDefault('')
})

setFilters({ min: 10, max: 90, category: 'tech' })

// ❌ Bad - Multiple URL updates
const [min, setMin] = useQueryState('min', parseAsInteger.withDefault(0))
const [max, setMax] = useQueryState('max', parseAsInteger.withDefault(100))
const [cat, setCat] = useQueryState('category', parseAsString.withDefault(''))

setMin(10)
setMax(90)
setCat('tech')
```

### 4. Use Enums for Fixed Options

```tsx
// ✅ Good - Type-safe options
const sortOptions = ['asc', 'desc', 'newest'] as const
const [sort, setSort] = useQueryState(
  'sort',
  parseAsStringEnum([...sortOptions]).withDefault('asc')
)

// ❌ Bad - Any string allowed
const [sort, setSort] = useQueryState('sort', { defaultValue: 'asc' })
```

## Testing

When testing components that use nuqs:

```tsx
import { NuqsAdapter } from '@beztack/state/adapters/testing'

function renderWithNuqs(component) {
  return render(
    <NuqsAdapter>
      {component}
    </NuqsAdapter>
  )
}
```

## Performance Considerations

1. **URL Updates**: Batched automatically when using `useQueryStates`
2. **Re-renders**: Only components using affected params re-render
3. **Bundle Size**: ~3kb gzipped for the entire library
4. **SSR**: Full support with server-side parsers

## Future Extensions

This package is designed to centralize state management. Future additions may include:

- Zustand integration for global state
- React Query helpers and utilities
- Form state management utilities
- Local storage sync utilities

## Migration from Direct nuqs Usage

If you were using nuqs directly:

```tsx
// Before
import { useQueryState } from 'nuqs'
import { NuqsAdapter } from 'nuqs/adapters/react'

// After
import { useQueryState } from '@beztack/state'
import { NuqsAdapter } from '@beztack/state/adapters/react'
```

All functionality remains identical, just the import path changes.

## Support

- [nuqs Documentation](https://nuqs.dev/docs)
- [nuqs Playground](https://nuqs.dev/playground)
- Package README: `packages/state/README.md`
- Demo: Visit `/nuqs-demo` when running the app

## Version History

See [CHANGELOG.md](./CHANGELOG.md) for version history and changes.
