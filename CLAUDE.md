# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

beztack is an Nx workspace monorepo using pnpm as the package manager. The project contains:
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
pnpm add <package> --filter @beztack/ui
pnpm add <package> --filter @beztack/api
```

## Architecture

### Workspace Structure
- `apps/ui/` - React frontend application using Vite
- `apps/api/` - Nitro server application
- `packages/ai/` - AI SDK wrapper with Amazon Bedrock integration
- `packages/ocr/` - OCR utilities using Tesseract.js

### Frontend (`@beztack/ui`)
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS v4
- **UI Components**: Radix UI primitives with shadcn/ui patterns
- **State Management**: TanStack Query for server state
- **Forms**: React Hook Form with Zod validation
- **Routing**: React Router v7
- **Authentication**: Better Auth integration

### Backend (`@beztack/api`)
- **Framework**: Nitro (Universal JavaScript server)
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Better Auth
- **Configuration**: Server source in `apps/api/server/`

### Shared Packages
- `@beztack/ai` - Exports AI SDK with pre-configured Amazon Bedrock provider
- `@beztack/ocr` - Text extraction from images using Tesseract.js
- `@beztack/payments` - Polar payment integration with Better Auth, membership tiers, and billing management
- `@beztack/email` - React Email templates with Resend integration for transactional emails

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

The project includes comprehensive Polar payment integration through the `@beztack/payments` package, providing developer-first monetization capabilities.

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
POLAR_BASIC_MONTHLY_PRODUCT_ID=your-pro-product-id
POLAR_BASIC_YEARLY_PRODUCT_ID=your-pro-product-id
POLAR_PRO_MONTHLY_PRODUCT_ID=your-team-product-id
POLAR_PRO_YEARLY_PRODUCT_ID=your-team-product-id
POLAR_ULTIMATE_MONTHLY_PRODUCT_ID=your-enterprise-product-id
POLAR_ULTIMATE_YEARLY_PRODUCT_ID=your-enterprise-product-id
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
import { setupPolarForBetterAuth } from "@beztack/payments";

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

## Email Integration with React Email & Resend

The project includes a comprehensive email system through the `@beztack/email` package, providing React-based email templates with Resend delivery.

### Configuration

Set up environment variables in `.env`:

```bash
# Resend Email Integration
RESEND_API_KEY=re_your_api_key_here
RESEND_FROM_EMAIL=hello@yourdomain.com
RESEND_FROM_NAME=beztack  # Optional, defaults to 'beztack'
```

### Available Email Templates

- **Welcome Email** (`/api/email/welcome`) - User onboarding
- **Password Reset** (`/api/email/password-reset`) - Password recovery
- **Subscription Confirmation** (`/api/email/subscription-confirmation`) - Payment confirmations
- **Custom Email** (`/api/email`) - General purpose template

### API Usage

All endpoints accept POST requests with the following pattern:

```bash
# Welcome email
POST /api/email/welcome
{
  "to": "user@example.com",
  "username": "John Doe",
  "loginUrl": "https://beztack.app/login"
}

# Password reset email  
POST /api/email/password-reset
{
  "to": "user@example.com",
  "username": "John Doe",
  "resetUrl": "https://beztack.app/reset?token=abc123"
}

# Subscription confirmation
POST /api/email/subscription-confirmation
{
  "to": "user@example.com",
  "username": "John Doe",
  "planName": "Pro",
  "amount": "$29",
  "billingPeriod": "mes",
  "dashboardUrl": "https://beztack.app/billing"
}
```

### Template Development

Email templates are located in `packages/email/emails/` using React Email components:

```bash
# Preview templates during development
cd packages/email
pnpm dev  # Starts preview server on :3001
```

### Key Features

- **HTML templates** with professional styling and responsive design
- **React components available** (requires JSX runtime configuration in server)
- **Robust error handling** with detailed validation and logging
- **Multi-recipient support** for bulk emails
- **Environment validation** ensures required credentials
- **Spanish localization** for user-facing content

### Template Options

**Recommended: HTML Templates**
- Use `welcomeEmailTemplate()`, `passwordResetTemplate()` functions
- Work immediately with any server setup
- Professional styling and responsive design
- Full customization with parameters

**Advanced: React Components** 
- Use `WelcomeEmail`, `PasswordResetEmail` components with `sendWithReact()`
- Require JSX runtime configuration in Nitro server
- Full React ecosystem support
- More complex but more flexible

### React Templates Limitation

React email templates currently require additional JSX runtime setup in Nitro server environment. The HTML template functions provide the same professional appearance and work immediately without additional configuration.