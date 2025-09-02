# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vitro is an Nx workspace monorepo using pnpm as the package manager. The project contains:
- **Frontend**: React application with Vite, Tailwind CSS, and Radix UI components
- **Backend**: Nitro server with PostgreSQL database using Drizzle ORM
- **Shared packages**: AI utilities (AWS Bedrock integration) and OCR functionality

## Common Commands

### Development
```bash
# Start all services
pnpm dev

# Start specific apps
nx dev ui          # Start React frontend
nx dev api         # Start Nitro backend

# Build the project
nx build

# Run tests
nx test

# Lint code
nx lint
```

### Database Operations
```bash
# Run database migrations
pnpm migrate
# or
nx run api:migrate
```

### Package Management
```bash
# Install dependencies
pnpm install

# Add dependencies to specific workspace
pnpm add <package> --filter @vitro/ui
pnpm add <package> --filter @vitro/api
```

## Architecture

### Workspace Structure
- `apps/ui/` - React frontend application using Vite
- `apps/api/` - Nitro server application
- `packages/ai/` - AI SDK wrapper with Amazon Bedrock integration
- `packages/ocr/` - OCR utilities using Tesseract.js

### Frontend (`@vitro/ui`)
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS v4
- **UI Components**: Radix UI primitives with shadcn/ui patterns
- **State Management**: TanStack Query for server state
- **Forms**: React Hook Form with Zod validation
- **Routing**: React Router v7
- **Authentication**: Better Auth integration

### Backend (`@vitro/api`)
- **Framework**: Nitro (Universal JavaScript server)
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Better Auth
- **Configuration**: Server source in `apps/api/server/`

### Shared Packages
- `@buncn/ai` - Exports AI SDK with pre-configured Amazon Bedrock provider
- `@buncn/ocr` - Text extraction from images using Tesseract.js

## Development Guidelines

### TypeScript Configuration
- Uses strict mode with comprehensive type checking
- Node.js-style module resolution (`nodenext`)
- Composite project references for monorepo optimization

### Code Organization
- Server utilities in `apps/api/server/utils/`
- React hooks in `apps/ui/src/hooks/`
- Shared components in `apps/ui/src/components/`
- Authentication utilities use Better Auth

### Database Schema
- Located at `apps/api/db/schema.ts`
- Use `pnpm migrate` to generate and apply schema changes
- Drizzle configuration in `apps/api/drizzle.config.ts`