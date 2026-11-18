# Better Auth Stripe plugin

Beztack does not add the Better Auth Stripe plugin, not even in test mode.

## Why this is out of scope

Beztack is a starter for B2B SaaS billing in Latin America. Billing already has
its own seam: `packages/payments/core` defines the provider contract, and
`packages/payments/mercado-pago` and `packages/payments/polar` implement it.
Mercado Pago is the main provider because it works in Uruguay and the region,
where Stripe does not let a local company take payments.

The Better Auth Stripe plugin would add a second, parallel billing model inside
the auth layer: its own subscription tables, webhooks and plan checks. That
competes with the payments packages instead of plugging into them, and it
cannot run in production for the people Beztack is built for.

If Stripe is ever needed, the way in is a new adapter under
`packages/payments/` that implements the core contract, not the auth plugin.

## Prior requests

- BZ-18: "Análisis de viabilidad y implementación condicional - Stripe Plugin"
