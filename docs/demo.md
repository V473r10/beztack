# Live demo

Beztack can run as a public demo where a visitor sees the billing depth without installing anything. This page is the design and the runbook. The code behind it ships in stages; the "Safety limits" table and "Open items" say what is not built yet.

## What a visitor sees

1. **Sign up** with any email and password. Email verification is off, and no email is sent in demo mode.
2. **Pick a plan** on the pricing page and check out in the **Mercado Pago sandbox** or the **Polar sandbox** (one provider per deployment, chosen by `PAYMENT_PROVIDER`).
3. **Change plan** with the proration preview: upgrades charge the difference, downgrades and cadence changes become a Pending Plan change that activates at renewal. The proration shows for a visitor who paid in the sandbox, not for the seeded customer or the admin (see "What is fake, what is sandbox").
4. **Open the admin pages** as the demo App admin: the Failed plan changes page lists one failed downgrade that the seed creates, with its Retry action.

A banner pinned to the bottom of every page reads "Demo: sandbox payments, data resets daily". The sign-in and sign-up pages also show a "How to try the demo" panel with the test cards of the active sandbox (Polar or Mercado Pago, from `VITE_PAYMENT_PROVIDER`) and the daily wipe notice. On wide screens it sits in the brand column; on a phone it is a collapsed section under the form. It never shows the admin credentials.

## How visitors reach it

Two deployments of the same code, each pointing at its own demo database:

- `apps/ui` as a static site on the demo domain, with `VITE_DEMO_MODE=true`.
- `apps/api` (Nitro) on a subdomain, with `DEMO_MODE=true`, and that domain in `APP_URL` and `CORS_ORIGINS`.

One deployment runs one payment provider. To show both, deploy twice (for example `polar.demo.<domain>` and `mp.demo.<domain>`), each with its own database. The demo domain and project are Facundo's to create; nothing in this repo deploys them.

Demo admin credentials: the seed creates the App admin from `DEMO_ADMIN_EMAIL` and `DEMO_ADMIN_PASSWORD`. The admin pages include user management, so publish the password only if that is acceptable on a wiped-daily database. Otherwise keep it private and show the admin pages in a recorded walkthrough.

The seeded customer (`customer@demo.beztack.test`, owner of the Demo Organization) signs in with `DEMO_CUSTOMER_PASSWORD`. It exists to record the walkthrough of `/billing` and the failed plan change, so keep it private too. The seed refuses to run without it and never prints it.

## Configuration

Names only. Values live in the hosting provider's secret store, never in the repo or in logs. Everything below comes from the `apps/api` env schema in `packages/env/src/api.ts`, plus `VITE_DEMO_MODE` from `packages/env/src/ui.ts`.

| Variable                              | Where | Purpose                                                                                                         |
| ------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------- |
| `DEMO_MODE`                           | api   | `true` turns on the demo guards below. Default `false`.                                                         |
| `VITE_DEMO_MODE`                      | ui    | `true` shows the banner and the auth "How to try the demo" panel. Set it together with `DEMO_MODE`.             |
| `DEMO_ADMIN_EMAIL`                    | api   | Email of the seeded App admin. Must also be listed in `APP_ADMIN_EMAILS`.                                       |
| `DEMO_ADMIN_PASSWORD`                 | api   | Password of the seeded App admin. Read only by the seed.                                                        |
| `DEMO_CUSTOMER_PASSWORD`              | api   | Password of the seeded customer. Read only by the seed. Never committed or logged.                              |
| `DEMO_MERCADO_PAGO_SANDBOX_CONFIRMED` | api   | Mercado Pago only: you confirm the access token is a test credential.                                           |
| `APP_ADMIN_EMAILS`                    | api   | Must contain `DEMO_ADMIN_EMAIL`.                                                                                |
| `DATABASE_URL`                        | api   | A database used only by the demo.                                                                               |
| `PAYMENT_PROVIDER`                    | api   | `polar` or `mercadopago`.                                                                                       |
| `POLAR_SERVER`                        | api   | Must be `sandbox`.                                                                                              |
| `POLAR_ACCESS_TOKEN`                  | api   | Polar sandbox organization access token.                                                                        |
| `POLAR_WEBHOOK_SECRET`                | api   | Secret of the webhook endpoint registered in the Polar sandbox.                                                 |
| `POLAR_ORGANIZATION_ID`               | api   | Polar sandbox organization id.                                                                                  |
| `POLAR_<TIER>_<CADENCE>_PRODUCT_ID`   | api   | Six sandbox product ids (`BASIC`, `PRO`, `ULTIMATE` × `MONTHLY`, `YEARLY`).                                     |
| `MERCADO_PAGO_ACCESS_TOKEN`           | api   | Test seller access token.                                                                                       |
| `MERCADO_PAGO_APPLICATION_ID`         | api   | Application id of the Mercado Pago app.                                                                         |
| `MERCADO_PAGO_WEBHOOK_SECRET`         | api   | Signing secret of the webhook configured on that app.                                                           |
| `VITE_MERCADO_PAGO_PUBLIC_KEY`        | ui    | Test public key (Mercado Pago only).                                                                            |
| `DEFAULT_CURRENCY`, `DEFAULT_LOCALE`  | api   | Currency of the Mercado Pago plans (for example `UYU`) and the UI locale. Same two with `VITE_` on the UI side. |

Also required by the schema and not demo-specific: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `APP_NAME`, `APP_URL`, `CORS_ORIGINS`, `PAYMENTS_SUCCESS_URL`, `PAYMENTS_CANCEL_URL`, `RESEND_FROM_NAME`, `RESEND_FROM_EMAIL`, `RESEND_API_KEY`.

## Fail-closed start

With `DEMO_MODE=true` the API refuses to start (the env module throws on load, so the build fails too) unless payments are sandbox:

- **Polar:** `POLAR_SERVER` must resolve to `sandbox`.
- **Mercado Pago:** `DEMO_MERCADO_PAGO_SANDBOX_CONFIRMED=true` is required. The code cannot prove a Mercado Pago token is a test one, because test and live access tokens both start with `APP_USR-`. The flag is a deliberate human attestation, and the error message says so. It does not inspect the token.

The check is `assertDemoSandboxPayments` in `packages/env/src/demo.ts`. Its error messages never contain a credential.

## Demo data and reset

`pnpm demo:seed` upserts fixed-id rows, so running it twice changes nothing and running it after a visitor edited a fixture restores that fixture:

- the plan catalog for the active provider (Polar: 3 paid tiers × monthly/yearly plus Free; Mercado Pago: monthly only);
- an App admin (`DEMO_ADMIN_EMAIL`, role `sudo`, with a password hash from better-auth; the password is never stored in clear or printed);
- a customer user (`customer@demo.beztack.test`; `.test` is reserved, so mail to it cannot reach a real inbox) with a password from `DEMO_CUSTOMER_PASSWORD`, and the **Demo Organization**, on Pro monthly;
- the organization's Pro Subscription, id `demo_sub_pro`, pointing at the Pro monthly plan row, so its amount and currency are the catalog's, in minor units (Polar: `2900` USD is US$ 29.00; Mercado Pago: the project currency);
- one **failed Pending Plan change** (a downgrade to Basic that failed activation 5 times, effective at the renewal it failed on), so the Failed plan changes page has a row.

`pnpm demo:reset` empties every table and seeds again. Both check the provider products first (see "Provider products"). It refuses to run unless `DEMO_MODE=true`. Both scripts run in `apps/api` and read `apps/api/.env`; in CI or on a server pass the same variables through the environment.

For Polar, the seed copies the six product ids from the env into the plan rows. For Mercado Pago the plan rows have no provider plan id after the seed. Push them to the provider from the admin **Plan sync** screen (the `push-to-provider` direction) before a visitor checks out; a reset clears the ids, so repeat it after each reset (see "Open items"). This step is not verified end to end yet, because it needs real test credentials.

Reset schedule: once a day, matching the banner. Nothing schedules it yet. Options, in order of effort: a GitHub Actions `schedule` workflow that runs `pnpm demo:reset` with the demo `DATABASE_URL` as a repository secret, or a cron route on the API protected by `requireCronSecret`. A reset deletes local data only; customers and subscriptions created in the Polar or Mercado Pago sandbox stay there and can be cleaned from their sandbox dashboards.

## What is fake, what is sandbox

| Thing                                                                          | Real sandbox or fake                                                                                                                                                     |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Visitor sign-up, checkout, payment, webhooks, Subscriptions a visitor creates  | **Real sandbox** (Polar or Mercado Pago). No real money moves.                                                                                                           |
| Plan change preview and proration for a visitor who paid                       | **Real sandbox**. Computed by Beztack from the visitor's real sandbox Subscription.                                                                                      |
| The seeded Pro Subscription `demo_sub_pro` of the Demo Organization            | **Fake.** It exists only in the demo database; the provider has never heard of it.                                                                                       |
| What `/billing` shows for the Demo Organization owner (Pro, amount, period)    | **Fake**, read from the `demo_sub_pro` row and the plan catalog.                                                                                                         |
| Retry of the seeded failed plan change, and the cancellation of `demo_sub_pro` | **Fake.** The Beztack side is real (the Pending Plan change moves to `activated`, the Membership moves to Basic); the "provider" step is answered by the demo decorator. |
| The admin's plan change                                                        | An Admin tier override (ADR 0004), never a provider call.                                                                                                                |

The fake is a decorator over the real payment adapter (`withDemoSubscriptions` in `apps/api/server/utils/demo-payment-provider.ts`). For ids that start with `demo_sub_` it answers reading a Subscription, moving it to another product (this is how a Pending Plan change is activated, and how the amount changes), and canceling it, from the `subscription` row. Every other call, and every other id, goes to the real adapter. It cannot be switched on by accident: it is built only when `DEMO_MODE` is exactly `true`; with `DEMO_MODE` off `ensurePaymentProvider()` returns the real adapter itself and a `demo_sub_*` id is sent to the real provider like any other. A test covers both cases.

The proration preview is not shown on the seeded Subscription: the seeded customer would need a real sandbox payment for that. To see the proration, sign up as a visitor, pay for a plan in the sandbox and change plan.

## Provider products

A stale or mis-copied `POLAR_*_PRODUCT_ID` seeds without complaint and then shows up as pricing cards with no features and a 400 at checkout. So `pnpm demo:seed` and `pnpm demo:reset` first ask the active payment provider for each configured product, and stop before writing anything (and before a reset empties the tables) if one is wrong:

```text
[demo-seed] Error: The payment provider does not match the demo configuration:
  - POLAR_PRO_YEARLY_PRODUCT_ID (0b3c...) not found in the provider (an old or mis-copied id, or another account)
  - POLAR_BASIC_MONTHLY_PRODUCT_ID (91fd...) has tier "pro", expected "basic"
```

Every problem is listed, with the variable to fix and the id it holds. A product is wrong when it does not exist for the configured Polar organization and server, has no `metadata.tier`, has a different tier than its variable name says, or bills monthly where the variable says yearly (or the reverse).

`pnpm demo:check` runs only this check. It reads from the provider, writes nothing and opens no database connection, so run it after changing a `POLAR_*_PRODUCT_ID` and before the seed. It needs `DEMO_MODE=true` like the seed. Neither command prints a token, a key or the provider's own error text.

Mercado Pago has nothing to check here: its plan ids are created by Plan sync (see "Demo data and reset").

### Create the products in the Polar sandbox

At [sandbox.polar.sh](https://sandbox.polar.sh), in the organization named by `POLAR_ORGANIZATION_ID`, create six recurring products. Use the same amounts as the seed catalog (`packages/db/src/plan-catalog.ts`):

| Product        | Billing | Price (USD) | `metadata.tier` | Env variable                        |
| -------------- | ------- | ----------- | --------------- | ----------------------------------- |
| Basic monthly  | Monthly | 9           | `basic`         | `POLAR_BASIC_MONTHLY_PRODUCT_ID`    |
| Basic yearly   | Yearly  | 90          | `basic`         | `POLAR_BASIC_YEARLY_PRODUCT_ID`     |
| Pro monthly    | Monthly | 29          | `pro`           | `POLAR_PRO_MONTHLY_PRODUCT_ID`      |
| Pro yearly     | Yearly  | 290         | `pro`           | `POLAR_PRO_YEARLY_PRODUCT_ID`       |
| Ultimate month | Monthly | 99          | `ultimate`      | `POLAR_ULTIMATE_MONTHLY_PRODUCT_ID` |
| Ultimate year  | Yearly  | 990         | `ultimate`      | `POLAR_ULTIMATE_YEARLY_PRODUCT_ID`  |

Add the `tier` key under the product's metadata; it is what ties a Polar product to a plan row. Copy each product's id (a UUID) into its variable in `apps/api/.env`, then run `pnpm demo:check`. Archive products you replaced: an archived product may still answer by id, and the check does not look at whether a product is archived.

## Safety limits

| Limit                                  | Status                                                                                                                                                                                               |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sandbox payments only, no real money   | Enforced at start for Polar. Attested by an env flag for Mercado Pago.                                                                                                                               |
| No email to real addresses             | Enforced in demo mode: better-auth emails (such as organization invitations) are dropped, and the unauthenticated `/api/email/*` routes answer 403. Mail to the seeded customer cannot be delivered. |
| Wipe on reset is demo-only             | `demo:reset` requires `DEMO_MODE=true` and a database used only by the demo.                                                                                                                         |
| Visitors cannot use the admin pages    | The admin pages need the `sudo` role and an email on `APP_ADMIN_EMAILS`; sign-up creates neither.                                                                                                    |
| Rate limits on sign-up and checkout    | **Not built.** Put a platform rule in front (Vercel Firewall or Cloudflare rate limiting) on `/api/auth/sign-up/*` and `/api/subscriptions/checkout` before announcing the URL.                      |
| Reject live-mode Mercado Pago webhooks | **Not built.** Mercado Pago webhooks carry a `live_mode` flag; the demo should drop events where it is `true`.                                                                                       |
| Daily reset scheduled                  | **Not built.** See "Demo data and reset".                                                                                                                                                            |

## What Facundo must provide

- [ ] **Polar sandbox:** an organization at sandbox.polar.sh, an organization access token, six products (Basic, Pro, Ultimate × monthly, yearly), a webhook endpoint pointing at the demo API with its secret. Gives `POLAR_ORGANIZATION_ID`, `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`, the six `POLAR_*_PRODUCT_ID`.
- [ ] **Mercado Pago test setup:** a developer application with test credentials, a test seller and test buyer users for the country of `DEFAULT_CURRENCY`, and the application webhook pointed at the demo API. Gives `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_APPLICATION_ID`, `MERCADO_PAGO_WEBHOOK_SECRET`, `VITE_MERCADO_PAGO_PUBLIC_KEY`. Visitors need the test cards and test buyer email, shown on the demo page.
- [ ] **Demo domain and hosting:** a domain (or subdomains), one project for `apps/ui` and one for `apps/api`, with the environment variables above. Per the free-tier rules of the host, check that a public demo is allowed on the plan you use.
- [ ] **Demo database:** a PostgreSQL database used only by the demo, migrated with `pnpm db:migrate`, with its `DATABASE_URL`.
- [ ] **Resend:** the schema requires `RESEND_API_KEY`, `RESEND_FROM_NAME` and `RESEND_FROM_EMAIL`. A valid key is enough, since demo mode sends nothing.
- [ ] **Decisions:** whether the admin password is public; one deployment per provider or only one; where the daily reset runs.

## Open items for later PRs

- Schedule the daily reset (workflow or cron route).
- Rate limits and the Mercado Pago `live_mode` webhook guard.
- A real sandbox subscription behind the seeded fixture, to show proration for the seeded customer. Polar creates Subscriptions through the API only for free products, so it needs a checkout with a 100% discount; a spike first.
- Re-run Plan sync automatically after a Mercado Pago reset.
- Test buyers for the Mercado Pago panel (the panel shows test cards only).
