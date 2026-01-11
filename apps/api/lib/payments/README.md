# Payment Provider Abstraction

This module provides a unified interface for payment/subscription providers, allowing you to switch between **Polar** and **Mercado Pago** via configuration.

## Configuration

Set the `PAYMENT_PROVIDER` environment variable:

```bash
# Use Polar (default)
PAYMENT_PROVIDER=polar

# Use Mercado Pago
PAYMENT_PROVIDER=mercadopago
```

## API Endpoints

All endpoints work with both providers transparently:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/subscriptions/products` | List available products/plans |
| POST | `/api/subscriptions/checkout` | Create checkout session |
| GET | `/api/subscriptions` | List user's subscriptions |
| GET | `/api/subscriptions/:id` | Get subscription details |
| PATCH | `/api/subscriptions/:id` | Update subscription (pause/resume/change plan) |
| DELETE | `/api/subscriptions/:id` | Cancel subscription |
| POST | `/api/subscriptions/webhooks` | Webhook handler |

## Usage

### Backend

```typescript
import { getPaymentProvider } from "@/lib/payments";

// Get the configured provider
const provider = getPaymentProvider();

// List products
const products = await provider.listProducts();

// Create checkout
const checkout = await provider.createCheckout({
  productId: "prod_123",
  customerEmail: "user@example.com",
  successUrl: "https://example.com/success",
});

// Manage subscriptions
const subscription = await provider.getSubscription("sub_123");
await provider.cancelSubscription("sub_123");
```

### Frontend

```typescript
// The frontend doesn't need to know which provider is being used
const response = await fetch("/api/subscriptions/checkout", {
  method: "POST",
  body: JSON.stringify({
    productId: "prod_123",
  }),
});

const { checkoutUrl } = await response.json();
window.location.href = checkoutUrl;
```

## Provider-Specific Notes

### Polar
- Products are managed in the Polar dashboard
- Uses UUID product IDs
- Supports customer portal for self-service

### Mercado Pago
- Plans are created via `preapproval_plan` API
- Subscriptions use `preapproval` API
- Checkout redirects to Mercado Pago payment page

## Types

See `types.ts` for the complete interface definition:

- `Product` - Unified product/plan representation
- `Subscription` - Unified subscription representation
- `Customer` - Unified customer representation
- `PaymentProviderAdapter` - Interface all providers implement

## Adding a New Provider

1. Create adapter in `adapters/` directory
2. Implement `PaymentProviderAdapter` interface
3. Add case to `getPaymentProvider()` in `index.ts`
4. Add env variable to schema in `packages/env/src/api.ts`
