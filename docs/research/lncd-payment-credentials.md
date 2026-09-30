# Research: lncd per-organization payment credentials

Ticket: #41 (map #37). Sources: lncd checkout `w-Beztack/lncd` (current working tree), Beztack `origin/main` at `e3016d0`, frozen PRD #15, Beztack ADR-0003.

## Verdict

**The concept is generic. lncd's implementation is not.** "Each tenant connects its own provider account and gets paid directly" is a general multi-tenant capability, like Stripe Connect. In lncd it is Mercado Pago only, it is wired to the Order flow end to end, and it lives under `/api/orders/*`. **It does not touch subscriptions.** Beztack billing its tenants still uses the single platform credential from env. For map #37 this falls under **B (lncd-specific)**: nothing in Beztack would call it without lncd's Order domain, which is out of scope. A few pieces are worth keeping as a reference design if Beztack ever adds "tenant-owned payment accounts": the table shape, the AES-GCM helpers, and the per-tenant webhook URL.

Counts (9 files): **A = 0, B = 8, C = 1**.

## How credentials are resolved today (lncd)

| Flow | Credential source | Code |
|---|---|---|
| Platform Subscription billing (Beztack charging tenants) | env `MERCADO_PAGO_ACCESS_TOKEN` + `MERCADO_PAGO_APPLICATION_ID`, a single `createMercadoPagoClient` per process | `apps/api/server/routes/api/payments/mercado-pago/webhook.post.ts`, `packages/payments/mercado-pago/src/adapter.ts` (`resolveRequiredApplicationId`), core `createPaymentProvider` (one cached adapter) |
| Order checkout (tenant charging its customers) | `organization_payment_credentials` row for `(orgId, "mercado_pago")`, decrypted per request | `order-lifecycle.ts`: `getOrgPaymentCredentials(org.id, "mercado_pago")` → `createCheckoutUrl` → `createMPCheckoutPreference` (at lines ~333 and ~505) |
| Order payment webhook | Org comes from the URL path `/api/payments/mercado-pago/webhook/[orgId]` (lncd sets it as `notification_url` on the preference) → `getOrgPaymentCredentials` → `fetchMPPaymentAsOrg` → `external_reference` = orderId → `updateOrderPaymentFromMercadoPago` | `routes/api/payments/mercado-pago/webhook/[orgId].post.ts` |

So resolution is **by URL path (webhook) or active org (checkout)**. No MP payload is ever used to pick the tenant. The two paths never mix: the platform webhook's header comment says so explicitly, and the `[orgId].post.test.ts` case "keeps restaurant order payments on organization credentials" checks it.

## Per-file classification

| File (lncd) | Class | Reason |
|---|---|---|
| `apps/api/server/utils/org-payment-credentials.ts` | B | Mixes three things. (1) Generic AES-256-GCM `encryptToken`/`decryptToken`/`getKey`. (2) `getOrgPaymentCredentials` with the provider type pinned to the literal `"mercado_pago"`. (3) Hand-rolled MP HTTP (`mpFetchAs`, `verifyMPCredentials` → `/users/me`, `createMPCheckoutPreference`, `fetchMPPaymentAsOrg`). Part (3) duplicates `packages/payments/mercado-pago/src/server/client.ts` (`checkout.createPreference`, payments get), and it has no retry or timeout. Only Orders use it. |
| `apps/api/server/routes/api/orders/payment-credentials.put.ts` | B | Mounted under `/orders`. Imports `requireOrgAdmin` from `utils/menu` and `upsertCredentialsSchema` from `utils/orders` (both lncd domain). MP only. Sets `isLive = true` whenever `/users/me` succeeds, so a TEST- token is still reported as live. |
| `apps/api/server/routes/api/orders/payment-credentials/[provider].delete.ts` | B | Same coupling (`/orders`, `utils/menu`). Accepts only `mercado_pago`. The pattern is fine, the placement is domain-specific. |
| `apps/api/server/routes/api/payments/mercado-pago/webhook/[orgId].post.ts` | B | Maps a payment to an **Order** through `external_reference`. No `x-signature` verification: it re-fetches the payment with the tenant token, so a forged body can only trigger a re-read, but no signature is checked. `webhookLog` dedup keys on `provider="mercadopago"` + event id with no org, so the naming differs from `"mercado_pago"` in the credentials table. |
| `apps/api/server/routes/api/orders/settings.get.ts` (credentials part) | B | Exposes a credentials summary (never the token) inside Order settings. |
| `packages/db/src/schema.ts` → `organizationPaymentCredentials` (+ `drizzle/0000_initial.sql`) | B | The shape is generic and good: org FK with cascade, `provider` text, `access_token_encrypted`, `public_key`, `user_id_at_provider`, `is_live`, `configured_at`/`verified_at`, `UNIQUE(org, provider)`. But its only consumer is Orders, and Beztack has no counterpart table. It lacks a provider-native boundary column (MP application/collector id, see PRD #15 / ADR-0003). |
| `packages/env/src/api.ts` → `PAYMENT_CREDENTIALS_KEY` | B | Exists only for this feature. `z.string().min(32).default("")` combined with `emptyStringAsUndefined` means the key is effectively required at boot even for projects that never use per-org credentials. The comment says "hex-encoded = 64 chars", but `getKey` SHA-256-hashes any string. |
| `apps/ui/src/hooks/use-orders.ts` (`useUpsertPaymentCredentials`, `useDeletePaymentCredentials`) + `apps/ui/src/app/private/orders/ordering-settings.tsx` | B | Restaurant ordering settings UI with Spanish copy ("El dinero va directo a tu cuenta"). |
| `apps/api/server/routes/api/payments/mercado-pago/webhook.post.ts` (platform) | C | On credential resolution both sides are identical: a single env credential. The lncd diff is the older inline projection (`projectSubscriptionWebhookEvent`) against Beztack's `projectSubscriptionProviderEvent` envelope, plus a header comment. That diff belongs to the subscriptions research, not here. |

ADR-0007 (lncd) lists `/api/orders/payment-credentials*` among owner/admin-only routes. That is a reference only and needs no classification.

## Subscriptions vs tenant-charges-customers

**Only the tenant charging its own customers uses this.** It creates one-off Checkout Pro preferences, never preapproval or subscription plans. Platform subscriptions stay on env credentials with a native Application-ID boundary (PRD #15 design, already present on Beztack `main` in `packages/payments/mercado-pago/src/adapter.ts` and `packages/env/src/api.ts` `assertRequired("MERCADO_PAGO_APPLICATION_ID")`). PRD #15 applies to the platform credential only, and its Out of Scope explicitly excludes "direct-payment isolation for Mercado Pago payments that are not tied to a subscription/preapproval". The two concepts are orthogonal. The per-org flow is isolated naturally, because each tenant's own token can only read its own account's payments. It does not need PRD #15's Application-ID filter, but it also does not enforce it.

## What it would take to express it through `packages/payments/core`

Core today assumes **one adapter per process**. `createPaymentProvider(provider, config)` caches a single `cachedAdapter`, and `getPaymentProvider()` has no tenant argument. `CreateCheckoutOptions` requires a `productId` (a catalog plan). There is no ad-hoc line-items checkout. Minimum changes:

1. **Scoped adapters.** Add `createScopedPaymentProvider(provider, config)` with no global cache (or a cache keyed by `(provider, orgId)` with an invalidation hook on credential upsert/delete). The existing `ProviderAdapterFactory(config)` signature already fits, because MP's `createMercadoPagoAdapter({ accessToken, ... })` and Polar's factory both take config.
2. **Credentials store in core, not in an app.** Add a provider-agnostic `TenantPaymentCredentials` type plus `get/put/delete` against a generic table (`organization_payment_credentials` shape, `provider` typed as `PaymentProviderName`, fixing `"mercado_pago"` vs `"mercadopago"`). Keep the AES-GCM helpers in the API or a shared util, with the key required only when the feature is enabled.
3. **Provider-specific connect/verify goes in the adapter.** Add an optional adapter method such as `verifyCredentials(config) → { accountId, isLive }` (MP: `/users/me` plus a `TEST-` prefix check; Polar: org token introspection). `accountId` becomes the native boundary stored in `user_id_at_provider`, which keeps ADR-0003's rule.
4. **One-off checkout.** Either widen `CreateCheckoutOptions` with `lineItems` + `externalReference` + `notificationUrl`, or add `createPaymentCheckout`. MP maps it to `checkout.createPreference` (already in `server/client.ts`). Polar would need ad-hoc prices or checkout links, which needs investigation.
5. **Per-tenant webhooks.** A generic route `/api/payments/:provider/webhook/:orgId` resolves scoped credentials, verifies the signature (the MP per-org route lacks this today), and emits a core `payment.*` event with `externalReference`. The domain handler (lncd: Orders) subscribes to it. The Order mapping stays in the app.
6. **CLI.** `packages/cli/src/modules.ts` gets an opt-in "tenant payment accounts" module, off by default, so templates that do not need it skip the env key, the table and the routes.

Estimated size: a new core capability (about 5 touch points plus a migration), not a port. None of lncd's files can be copied as-is.

## Open questions for the grilling

- Does Beztack want "tenant-owned payment accounts" as a template capability at all (marketplace/B2B2C projects), or does it stay out of scope with the rest of Orders? If it is out, the whole area closes as B.
- If it is in: what is the domain term (for example **Merchant payment account**, as opposed to the platform **Payment integration**), and does it need an ADR next to ADR-0003?
- Is a scoped adapter (a second adapter instance per org) acceptable in core, or does it break the "one active provider" assumption the CLI codemods rely on?
- Can a tenant's provider differ from the platform provider (a platform on Polar, tenants on MP)? That decides whether the provider comes from the credential row or from `PAYMENT_PROVIDER`.
- Should `webhookLog` dedup include `organizationId` for per-tenant webhooks?
- Which one-off checkout shape is right: extend `createCheckout` or add a separate method? This needs Polar feasibility checked first.
