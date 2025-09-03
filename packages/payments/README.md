# @buncn/payments

Polar payment integration package for the Vitro monorepo. This package provides complete payment and subscription management functionality integrated with Polar and Better Auth.

## Features

- 🔐 **Better Auth Integration**: Seamless integration with Better Auth
- 💳 **Polar Payments**: Complete Polar SDK integration
- 🎯 **Membership Tiers**: Pre-configured Free, Pro, Team, and Enterprise tiers
- 🔧 **Server Utils**: Webhook handling, configuration, and server-side utilities
- ⚛️ **React Hooks**: Ready-to-use React hooks for client-side integration
- 📊 **Usage Tracking**: Usage-based billing and metrics tracking
- ✅ **Type Safety**: Full TypeScript support with comprehensive type definitions
- 🔒 **Permissions**: Role-based access control and permission validation

## Installation

This package is part of the Vitro monorepo and should be used internally:

```bash
pnpm install @buncn/payments
```

## Quick Setup

### 1. Environment Configuration

Add these environment variables:

```bash
# .env
POLAR_ACCESS_TOKEN=your_polar_access_token
POLAR_WEBHOOK_SECRET=your_webhook_secret
POLAR_PRO_PRODUCT_ID=your_pro_product_id
POLAR_TEAM_PRODUCT_ID=your_team_product_id  
POLAR_ENTERPRISE_PRODUCT_ID=your_enterprise_product_id
```

### 2. Server Setup (Better Auth)

```typescript
import { betterAuth } from "better-auth";
import { setupPolarForBetterAuth } from "@buncn/payments";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema: schema }),
  plugins: [
    // Other plugins...
    setupPolarForBetterAuth({
      // Custom webhook handlers
      onOrderPaid: async (payload) => {
        // Handle successful payment
      },
      onSubscriptionActive: async (payload) => {
        // Handle subscription activation
      },
    }),
  ],
});
```

### 3. Client Setup

```typescript
import { createAuthClient } from "better-auth/react";
import { polarClient } from "@polar-sh/better-auth";

export const authClient = createAuthClient({
  plugins: [polarClient()],
});
```

## Usage

### Membership Validation

```typescript
import { validateMembership, hasPermission } from "@buncn/payments";

// Validate user membership
const membershipResult = validateMembership(customerPortalState);

if (membershipResult.isValid) {
  console.log(`User has ${membershipResult.tier} membership`);
  
  // Check specific permissions
  if (hasPermission(membershipResult, "dashboard:analytics")) {
    // User can access analytics
  }
}
```

### React Hooks

```typescript
import { useCustomerState, useSubscriptionManagement } from "@buncn/payments/client";

function BillingPage() {
  const { data: customerState, isLoading } = useCustomerState(authClient);
  const { upgradeToTier, manageSubscription } = useSubscriptionManagement(authClient);

  const handleUpgrade = () => {
    upgradeToTier("pro", "yearly");
  };

  const handleManageSubscription = () => {
    manageSubscription();
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Current Plan: {customerState?.tier || "free"}</h1>
      <button onClick={handleUpgrade}>Upgrade to Pro</button>
      <button onClick={handleManageSubscription}>Manage Subscription</button>
    </div>
  );
}
```

### Usage Tracking

```typescript
import { useUsageTracking } from "@buncn/payments/client";

function MyComponent() {
  const usageTracking = useUsageTracking(authClient);

  const handleApiCall = async () => {
    // Track API usage
    await usageTracking.mutateAsync({
      event: "api_call",
      metadata: { 
        feature: "analytics",
        organizationId: "org_123" 
      },
    });
  };
}
```

### Server-side Webhook Handling

```typescript
import { 
  createWebhookHandler, 
  handleWebhookRequest,
  type MembershipUpdate 
} from "@buncn/payments/server";

// Create webhook handler
const webhookHandler = createWebhookHandler(
  async (update: MembershipUpdate) => {
    // Update user membership in your database
    await updateUserMembership(update.userId, {
      tier: update.tier,
      status: update.status,
      validUntil: update.validUntil,
    });
  }
);

// Handle webhook in your API route
export async function POST(request: Request) {
  const result = await handleWebhookRequest(
    request,
    process.env.POLAR_WEBHOOK_SECRET!,
    webhookHandler
  );

  if (result.success) {
    return new Response("OK", { status: 200 });
  } else {
    return new Response(result.error, { status: 400 });
  }
}
```

## Membership Tiers

The package includes pre-configured membership tiers:

### Free Tier
- Email/password authentication
- Basic dashboard access
- 1GB storage
- 1,000 API calls/month

### Pro Tier ($29/month, $290/year)
- Two-factor authentication
- Passkeys support
- Advanced analytics
- 10GB storage
- 10,000 API calls/month

### Team Tier ($99/month, $990/year)
- Organization management
- Team collaboration
- Role-based access control
- 100GB storage
- 50,000 API calls/month

### Enterprise Tier ($499/month, $4,990/year)
- Custom features
- Dedicated support
- Unlimited usage
- Advanced security

## API Reference

### Core Types

```typescript
import type {
  MembershipTier,
  MembershipTierConfig,
  UserMembership,
  Subscription,
  Customer,
  CheckoutSessionParams,
} from "@buncn/payments";
```

### Constants

```typescript
import {
  MEMBERSHIP_TIERS,
  PERMISSIONS,
  TIER_HIERARCHY,
} from "@buncn/payments";
```

### Utilities

```typescript
import {
  validateMembership,
  hasPermission,
  hasFeature,
  isWithinUsageLimits,
} from "@buncn/payments";
```

### Server Functions

```typescript
import {
  setupPolarForBetterAuth,
  createPolarClient,
  createWebhookHandler,
} from "@buncn/payments/server";
```

### Client Hooks

```typescript
import {
  useCustomerState,
  useSubscriptionManagement,
  useUsageTracking,
  useBillingPortal,
} from "@buncn/payments/client";
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `POLAR_ACCESS_TOKEN` | Your Polar organization access token | Yes |
| `POLAR_WEBHOOK_SECRET` | Secret for webhook signature verification | Yes |
| `POLAR_PRO_PRODUCT_ID` | Product ID for Pro tier | Optional |
| `POLAR_TEAM_PRODUCT_ID` | Product ID for Team tier | Optional |
| `POLAR_ENTERPRISE_PRODUCT_ID` | Product ID for Enterprise tier | Optional |
| `POLAR_SUCCESS_URL` | Custom success URL after checkout | Optional |
| `POLAR_CANCEL_URL` | Custom cancel URL after checkout | Optional |

## Integration with Applications

### Server Integration (`apps/api/`)

Add the Polar plugin to your Better Auth configuration:

```typescript
// apps/api/server/utils/auth.ts
import { setupPolarForBetterAuth } from "@buncn/payments";

export const auth = betterAuth({
  // existing config...
  plugins: [
    // existing plugins...
    setupPolarForBetterAuth(),
  ],
});
```

### Client Integration (`apps/ui/`)

Use the React hooks in your components:

```typescript
// apps/ui/src/pages/BillingPage.tsx
import { useSubscriptionManagement } from "@buncn/payments/client";
import { authClient } from "@/lib/auth-client";

export function BillingPage() {
  const { upgradeToTier, manageSubscription } = useSubscriptionManagement(authClient);
  
  // Component implementation...
}
```

## License

This package is part of the Vitro monorepo and is proprietary software.