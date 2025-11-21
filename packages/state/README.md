# @beztack/state

Centralized state management package for Beztack monorepo.

## Features

- **nuqs**: Type-safe URL search params state management
- Framework adapters for Next.js (App Router, Pages Router) and React SPA
- Shared utilities and helpers

## Installation

This package is internal to the monorepo. Add it to your app's dependencies:

```json
{
  "dependencies": {
    "@beztack/state": "workspace:*"
  }
}
```

## Usage

### React SPA (Vite)

```tsx
// main.tsx
import { NuqsAdapter } from '@beztack/state/adapters/react';
import { createRoot } from 'react-dom/client';

createRoot(document.getElementById('root')!).render(
  <NuqsAdapter>
    <App />
  </NuqsAdapter>
);
```

### Next.js App Router

```tsx
// app/layout.tsx
import { NuqsAdapter } from '@beztack/state/adapters/next/app';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <NuqsAdapter>{children}</NuqsAdapter>
      </body>
    </html>
  );
}
```

### Next.js Pages Router

```tsx
// pages/_app.tsx
import { NuqsAdapter } from '@beztack/state/adapters/next/pages';

export default function MyApp({ Component, pageProps }) {
  return (
    <NuqsAdapter>
      <Component {...pageProps} />
    </NuqsAdapter>
  );
}
```

### Using Query State

```tsx
import { useQueryState, parseAsInteger } from '@beztack/state';

function SearchComponent() {
  // String value
  const [search, setSearch] = useQueryState('q', { defaultValue: '' });
  
  // Number value with parser
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1));
  
  // Boolean value
  const [enabled, setEnabled] = useQueryState('enabled', parseAsBoolean);

  return (
    <div>
      <input value={search} onChange={e => setSearch(e.target.value)} />
      <button onClick={() => setPage(p => p + 1)}>Next Page</button>
      <button onClick={() => setEnabled(e => !e)}>Toggle</button>
    </div>
  );
}
```

### Built-in Parsers

```tsx
import {
  parseAsString,
  parseAsInteger,
  parseAsFloat,
  parseAsBoolean,
  parseAsStringEnum,
  parseAsArrayOf,
  parseAsJson
} from '@beztack/state';

// String enum
const [sort, setSort] = useQueryState(
  'sort',
  parseAsStringEnum(['asc', 'desc']).withDefault('asc')
);

// Array of strings
const [tags, setTags] = useQueryState(
  'tags',
  parseAsArrayOf(parseAsString).withDefault([])
);

// JSON object
const [filters, setFilters] = useQueryState(
  'filters',
  parseAsJson<FilterType>().withDefault({})
);
```

### Batching Updates

Use `useQueryStates` for multiple query params:

```tsx
import { useQueryStates, parseAsInteger } from '@beztack/state';

const [params, setParams] = useQueryStates({
  page: parseAsInteger.withDefault(1),
  limit: parseAsInteger.withDefault(10),
  search: { defaultValue: '' }
});

// Update multiple params at once
setParams({ page: 1, search: 'new search' });
```

## Documentation

- [nuqs Documentation](https://nuqs.dev/docs)
- [Playground](https://nuqs.dev/playground)

## Why nuqs?

- ✅ Type-safe URL search params
- ✅ Sync state with URL automatically
- ✅ Server-side rendering support
- ✅ Multiple framework support
- ✅ Batched updates
- ✅ Lightweight (~3kb gzipped)
