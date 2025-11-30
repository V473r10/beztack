<div align="center">
  <h1>Beztack</h1>
  <p><strong>You want to ship. You need this.</strong></p>
  <p>Production-ready TypeScript monorepo starter with modern tools and best practices built-in.</p>

  <p>
    <a href="#quick-start">Quick Start</a> •
    <a href="#architecture">Architecture</a> •
    <a href="#tech-stack">Tech Stack</a> •
    <a href="#packages">Packages</a> •
    <a href="#development">Development</a>
  </p>
</div>

---

## Overview

Beztack is a modern TypeScript monorepo starter designed to help you ship faster. Stop wasting time on boilerplate configuration and start building your product with enterprise-grade tooling from day one.

## Quick Start

```bash
# Clone and install
pnpm create beztack my-app
cd my-app
pnpm install

# Set up environment variables
cp .env.example .env

# Run database migrations
pnpm migrate

# Start development
pnpm dev
```

## Architecture

Three apps, one monorepo. Each optimized for its purpose.

```
apps/
├── ui/          # Frontend SPA (Vite + React)
├── api/         # Backend Server (Nitro)
└── docs/        # Landing & Documentation (Next.js + Fumadocs)

packages/
├── ai/          # AI SDK integration (Vercel AI + Amazon Bedrock)
├── cli/         # CLI tools
├── email/       # Email templates (React Email)
├── env/         # Environment validation (T3 Env)
├── ocr/         # OCR utilities
└── state/       # URL state management (nuqs)
```

### `apps/ui` - Frontend SPA

- **Vite** for lightning-fast HMR and builds
- **React 19** with modern patterns
- **shadcn/ui** components with Tailwind CSS
- **TanStack Router** for type-safe client-side routing
- **TanStack Query** for server state management

### `apps/api` - Backend Server

- **Nitro** (h3) for edge-ready, portable server
- **better-auth** for authentication (2FA, Organizations, Admin roles)
- **Drizzle ORM** for type-safe database queries
- **Polar** integration for payments and subscriptions
- File-based routing with auto-imports

### `apps/docs` - Landing & Documentation

- **Next.js 15** with App Router
- **Fumadocs** for beautiful MDX documentation
- SSR and static generation optimized
- SEO ready

## Tech Stack

| Category | Technology |
|----------|------------|
| **Monorepo** | NX |
| **Package Manager** | pnpm |
| **Frontend** | Vite, React, shadcn/ui, Tailwind CSS |
| **Backend** | Nitro (h3), Drizzle ORM |
| **Auth** | better-auth |
| **Payments** | Polar |
| **AI** | Vercel AI SDK, Amazon Bedrock |
| **Docs** | Next.js, Fumadocs |
| **Validation** | Zod, T3 Env |
| **State** | nuqs, TanStack Query |
| **Code Quality** | Biome, Ultracite, TypeScript |
| **Git Hooks** | Lefthook |

## Features

- **Authentication Ready** - better-auth with 2FA, Organizations, Admin roles, and Polar integration
- **Type-Safe Database** - Drizzle ORM with full TypeScript support
- **Modern UI** - shadcn/ui components, customizable and accessible
- **URL State** - nuqs for type-safe URL search params
- **AI Ready** - Vercel AI SDK with streaming, tool calling, and structured output
- **Environment Validation** - T3 Env for build-time env validation
- **Code Quality** - Biome/Ultracite for fast linting and formatting

## Packages

### `@beztack/ai`
AI SDK integration with Amazon Bedrock provider. Supports streaming, tool calling, structured output, and multi-modal capabilities.

### `@beztack/env`
Centralized environment variable validation using T3 Env and Zod schemas.

### `@beztack/state`
URL state management with nuqs. Type-safe parsers for synchronizing component state with URLs.

### `@beztack/email`
Email templates built with React Email for transactional emails.

### `@beztack/cli`
Command-line tools for project scaffolding and development utilities.

## Development

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL (or compatible database)

### Commands

```bash
# Start all apps in development mode
pnpm dev

# Build all apps
pnpm build

# Run linting
pnpm lint

# Run database migrations
pnpm migrate

# Push schema changes to database
pnpm push

# Run tests
pnpm test
```

### NX Commands

```bash
# Run a specific task
npx nx <target> <project>

# Visualize project graph
npx nx graph

# Run affected tasks
npx nx affected -t build

# Release
npx nx release
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Database
DATABASE_URL="postgresql://..."

# Auth
BETTER_AUTH_SECRET="..."
BETTER_AUTH_URL="http://localhost:3000"

# Polar (Payments)
POLAR_ACCESS_TOKEN="..."
POLAR_WEBHOOK_SECRET="..."

# Email
RESEND_API_KEY="..."
```

See `apps/api/env.ts` for the complete schema.

## Deployment

Beztack is designed to deploy anywhere:

- **Vercel** - Optimized for both frontend and serverless API
- **Cloudflare** - Edge deployment ready
- **Node.js** - Traditional server deployment
- **Docker** - Containerized deployment

## License

MIT

---

<div align="center">
  <p>Built with modern tools for developers who ship.</p>
  <p>
    <a href="https://nx.dev"><img src="https://img.shields.io/badge/NX-143055?style=flat&logo=nx&logoColor=white" alt="NX"></a>
    <a href="https://vitejs.dev"><img src="https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white" alt="Vite"></a>
    <a href="https://react.dev"><img src="https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black" alt="React"></a>
    <a href="https://nitro.build"><img src="https://img.shields.io/badge/Nitro-00DC82?style=flat&logoColor=white" alt="Nitro"></a>
    <a href="https://orm.drizzle.team"><img src="https://img.shields.io/badge/Drizzle-C5F74F?style=flat&logo=drizzle&logoColor=black" alt="Drizzle"></a>
  </p>
</div>
