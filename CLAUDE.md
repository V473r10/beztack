# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vitro is an Nx workspace monorepo using pnpm as the package manager. The project contains:
- **Frontend**: React application with Vite, Tailwind CSS, and Radix UI components
- **Backend**: Nitro server with PostgreSQL database using Drizzle ORM
- **Shared packages**: AI utilities (AWS Bedrock integration), OCR functionality, and payment processing with Polar

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
- `@buncn/payments` - Polar payment integration with Better Auth, membership tiers, and billing management

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

## Polar Payment Integration

The project includes comprehensive Polar payment integration through the `@buncn/payments` package, providing developer-first monetization capabilities.

### Configuration

Set up environment variables in `.env`:

```bash
# Polar Payment Integration
POLAR_ACCESS_TOKEN=polar_at_your_access_token_here
POLAR_WEBHOOK_SECRET=whsec_your_webhook_secret_here
POLAR_SERVER=sandbox  # or 'production'

# Optional: Product Configuration
POLAR_PRO_PRODUCT_ID=your-pro-product-id-here
POLAR_ENTERPRISE_PRODUCT_ID=your-enterprise-product-id-here
POLAR_SUCCESS_URL=http://localhost:5173/success?checkout_id={CHECKOUT_ID}
```

### Membership Tiers

- **Free**: Basic auth, 1GB storage, 1K API calls
- **Pro**: 2FA, passkeys, 10GB storage, 10K API calls ($29/mo)
- **Team**: Organizations, teams, 100GB storage, 50K API calls ($99/mo)  
- **Enterprise**: Unlimited usage, custom features ($499/mo)

### Backend Integration

The API automatically includes Polar integration when environment variables are configured:

```typescript
// In apps/api/server/utils/auth.ts
import { setupPolarForBetterAuth } from "@buncn/payments";

export const auth = betterAuth({
  plugins: [
    // Polar plugin is conditionally added based on environment
    setupPolarForBetterAuth(), // Includes checkout, portal, usage, webhooks
  ],
});
```

### Frontend Integration

Payment components are available throughout the UI:

- `/pricing` - Membership tier comparison and signup
- `/billing` - Subscription management and usage tracking
- Contextual upgrade prompts for premium features
- Real-time membership status updates

### Key Features

- **Checkout Integration**: Seamless subscription upgrades
- **Webhook Processing**: Real-time subscription updates at `/api/polar/webhooks`
- **Organization Support**: Team-level billing and subscriptions
- **Usage Tracking**: Tier-based limits with progress indicators
- **Membership Middleware**: API route protection based on subscription tier
- **Customer Portal**: Self-service subscription management

### Development Commands

```bash
# Test payment integration (requires Polar credentials)
nx dev api    # Backend with webhook endpoints
nx dev ui     # Frontend with payment components
```

The integration works in sandbox mode by default and gracefully handles missing credentials during development.