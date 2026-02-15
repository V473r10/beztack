# @beztack/mercadopago

SDK de Mercado Pago para Beztack. Proporciona integraciones de servidor y cliente React para pagos, suscripciones y checkout.

## Instalación

```bash
pnpm add @beztack/mercadopago
```

### Peer Dependencies

```bash
# Requerido
pnpm add zod

# Para componentes React (opcional)
pnpm add react @tanstack/react-query
```

## Estructura del Paquete

```
@beztack/mercadopago
├── /           # Tipos compartidos, schemas Zod, utilidades, i18n
├── /server     # Cliente servidor para API de Mercado Pago
└── /react      # Componentes React, hooks, provider
```

## Uso Básico

### Server Client

```typescript
import { createMercadoPagoClient } from "@beztack/mercadopago/server"

const mp = createMercadoPagoClient({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN,
  webhookSecret: process.env.MERCADO_PAGO_WEBHOOK_SECRET,
  timeout: 30000,      // opcional, default 30s
  maxRetries: 3,       // opcional, default 3
})

// Crear preferencia de checkout
const preference = await mp.checkout.createPreference({
  items: [{ title: "Producto", quantity: 1, unit_price: 100 }],
  back_urls: {
    success: "https://tu-sitio.com/success",
    failure: "https://tu-sitio.com/failure",
  },
})

// Obtener pago
const payment = await mp.payments.get("123456789")

// Buscar pagos
const payments = await mp.payments.search({
  status: "approved",
  begin_date: "2024-01-01T00:00:00Z",
})

// Reembolso completo
await mp.payments.refund("123456789")

// Reembolso parcial
await mp.payments.refund("123456789", 50.00)
```

### React Provider

```tsx
import { MercadoPagoProvider } from "@beztack/mercadopago/react"

function App() {
  return (
    <MercadoPagoProvider
      publicKey={import.meta.env.VITE_MP_PUBLIC_KEY}
      locale="es-UY"
      endpoints={{
        plans: "/api/mp/plans",
        subscriptions: "/api/mp/subscriptions",
      }}
    >
      <YourApp />
    </MercadoPagoProvider>
  )
}
```

### React Hooks

```tsx
import {
  usePlans,
  useSubscriptions,
  useSubscription,
  usePauseSubscription,
  useResumeSubscription,
  useCancelSubscription,
} from "@beztack/mercadopago/react"

function SubscriptionsList() {
  const { data, isLoading } = useSubscriptions({ status: "active" })
  const pauseMutation = usePauseSubscription()

  if (isLoading) return <div>Cargando...</div>

  return (
    <ul>
      {data?.subscriptions.map((sub) => (
        <li key={sub.id}>
          {sub.reason}
          <button onClick={() => pauseMutation.mutate(sub.id)}>
            Pausar
          </button>
        </li>
      ))}
    </ul>
  )
}
```

### Componentes UI

```tsx
import {
  PaymentStatusBadge,
  SubscriptionStatusBadge,
  SubscriptionCard,
  SubscriptionList,
  SubscriptionActions,
  BillingHistory,
} from "@beztack/mercadopago/react"

// Badge de estado de pago
<PaymentStatusBadge status="approved" locale="es" />

// Badge de estado de suscripción
<SubscriptionStatusBadge status="active" locale="en" />

// Card de suscripción
<SubscriptionCard
  subscription={subscription}
  locale="es-UY"
  showNextPayment
  showStats
  onClick={(sub) => console.log(sub.id)}
/>

// Lista de suscripciones
<SubscriptionList
  subscriptions={subscriptions}
  isLoading={isLoading}
  columns={3}
  onSelect={handleSelect}
/>

// Acciones de suscripción
<SubscriptionActions
  subscription={subscription}
  locale="es"
  onPause={handlePause}
  onResume={handleResume}
  onCancel={handleCancel}
/>

// Historial de facturación
<BillingHistory
  invoices={invoices}
  locale="es-UY"
  showTitle
/>
```

## API Reference

### Server Client

#### `createMercadoPagoClient(config)`

Crea una instancia del cliente de Mercado Pago.

```typescript
type MercadoPagoConfig = {
  accessToken: string       // Token de acceso de MP
  webhookSecret?: string    // Secreto para validar webhooks
  baseUrl?: string          // URL base (default: api.mercadopago.com)
  timeout?: number          // Timeout en ms (default: 30000)
  maxRetries?: number       // Reintentos máximos (default: 3)
  initialRetryDelay?: number // Delay inicial para retry (default: 1000)
}
```

#### Módulos del Cliente

| Módulo | Métodos |
|--------|---------|
| `payments` | `get`, `create`, `search`, `refund`, `getRefunds` |
| `plans` | `list`, `get`, `create`, `update`, `deactivate` |
| `subscriptions` | `create`, `get`, `update`, `cancel`, `pause`, `resume`, `search`, `listInvoices` |
| `checkout` | `createPreference`, `getPreference` |
| `customers` | `create`, `get`, `searchByEmail` |
| `invoices` | `get`, `search` |
| `merchantOrders` | `get` |
| `chargebacks` | `get` |
| `webhooks` | `validate`, `parse` |

### Manejo de Errores

```typescript
import { MercadoPagoError } from "@beztack/mercadopago/server"

try {
  await mp.payments.get("invalid-id")
} catch (error) {
  if (error instanceof MercadoPagoError) {
    console.log(error.statusCode)  // 404
    console.log(error.message)     // "Payment not found"
    console.log(error.retryable)   // false
    console.log(error.errorCause)  // Detalles adicionales
  }
}
```

### Webhooks

```typescript
// En tu endpoint de webhook (ej: Nitro/h3)
import { createMercadoPagoClient } from "@beztack/mercadopago/server"

export default defineEventHandler(async (event) => {
  const mp = createMercadoPagoClient({
    accessToken: process.env.MP_ACCESS_TOKEN,
    webhookSecret: process.env.MP_WEBHOOK_SECRET,
  })

  const xSignature = getHeader(event, "x-signature")
  const xRequestId = getHeader(event, "x-request-id")
  const body = await readBody(event)

  // Validar firma
  const isValid = mp.webhooks.validate(xSignature, xRequestId, body.data.id)
  if (!isValid) {
    throw createError({ statusCode: 401, message: "Invalid signature" })
  }

  // Parsear payload
  const payload = mp.webhooks.parse(JSON.stringify(body))

  // Procesar según tipo
  switch (payload.type) {
    case "payment":
      const payment = await mp.payments.get(payload.data.id)
      // Procesar pago...
      break
    case "subscription_preapproval":
      const subscription = await mp.subscriptions.get(payload.data.id)
      // Procesar suscripción...
      break
  }

  return { success: true }
})
```

## Internacionalización (i18n)

El SDK soporta múltiples idiomas para labels y formateo.

### Locales Soportados

- `es` / `es-UY` - Español (default)
- `en` / `en-US` - English

### Funciones de i18n

```typescript
import {
  t,
  getTranslations,
  getPaymentStatusLabel,
  getSubscriptionStatusLabel,
  formatFrequencyLocalized,
  formatPriceLocalized,
} from "@beztack/mercadopago"

// Obtener traducción por path
t("es", "components.billingHistory") // "Historial de Facturación"
t("en", "components.billingHistory") // "Billing History"

// Labels de estado
getPaymentStatusLabel("approved", "es")     // "Aprobado"
getSubscriptionStatusLabel("active", "en")  // "Active"

// Formateo de frecuencia
formatFrequencyLocalized(1, "months", "es") // "cada mes"
formatFrequencyLocalized(3, "months", "en") // "every 3 months"

// Formateo de precio
formatPriceLocalized(1500, "UYU", "es-UY")  // "$ 1.500"
formatPriceLocalized(99.99, "USD", "en-US") // "$99.99"
```

### Componentes con i18n

Todos los componentes aceptan una prop `locale`:

```tsx
<SubscriptionCard subscription={sub} locale="en" />
<BillingHistory invoices={invoices} locale="es-UY" />
<SubscriptionActions subscription={sub} locale="en-US" />
```

## Schemas Zod

```typescript
import {
  createPlanSchema,
  createSubscriptionSchema,
  frequencyTypeSchema,
  planStatusSchema,
  subscriptionStatusSchema,
} from "@beztack/mercadopago"

// Validar datos de plan
const planData = createPlanSchema.parse({
  reason: "Plan Premium",
  auto_recurring: {
    frequency: 1,
    frequency_type: "months",
    transaction_amount: 1500,
    currency_id: "UYU",
  },
})

// Validar datos de suscripción
const subData = createSubscriptionSchema.parse({
  preapproval_plan_id: "plan_123",
  payer_email: "user@example.com",
})
```

## Tipos TypeScript

```typescript
import type {
  // Pagos
  PaymentStatus,
  MPPaymentResponse,
  MPPaymentSearchParams,
  ProcessPaymentData,
  
  // Planes
  Plan,
  PlanStatus,
  CreatePlanData,
  PlansResponse,
  
  // Suscripciones
  Subscription,
  SubscriptionStatus,
  CreateSubscriptionData,
  
  // Checkout
  PreferenceItem,
  PreferenceResponse,
  CreatePreferenceData,
  
  // Webhooks
  WebhookPayload,
  
  // i18n
  SupportedLocale,
  TranslationKeys,
} from "@beztack/mercadopago"
```

## Testing

```bash
# Ejecutar tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage
pnpm test:coverage
```

## Licencia

MIT
