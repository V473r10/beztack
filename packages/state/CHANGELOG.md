# Changelog

All notable changes to this project will be documented in this file.

## [0.0.1] - 2024-11-21

### Added
- Initial release of @beztack/state package
- Integration with nuqs v2.8.1 for type-safe URL search params
- Framework adapters:
  - React SPA adapter (`/adapters/react`)
  - Next.js unified adapter (`/adapters/next`)
  - Next.js App Router adapter (`/adapters/next/app`)
  - Next.js Pages Router adapter (`/adapters/next/pages`)
- Re-exported all nuqs core functionality:
  - `useQueryState` - Single query param hook
  - `useQueryStates` - Multiple query params hook (batched updates)
  - Built-in parsers: String, Integer, Float, Boolean, StringEnum, Array, JSON, IsoDateTime, Timestamp, Hex
  - Server-side parsers and utilities
  - TypeScript types and interfaces
- Comprehensive README with usage examples
- Full TypeScript support with type inference

### Features
- Type-safe URL search params management
- Automatic URL synchronization
- Server-side rendering support
- Batched updates for multiple params
- Default values with type inference
- Zero configuration required
