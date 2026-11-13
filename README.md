<div align="center">
  <h1>Beztack</h1>
  <p><strong>The TypeScript starter for B2B SaaS that charges in LatAm and worldwide.</strong></p>
  <p>Mercado Pago and Polar billing, Better Auth organizations, a Vite + React app and a Nitro API, in one Nx monorepo.</p>

  <p>
    <a href="#quick-start">Quick Start</a> •
    <a href="#payments">Payments</a> •
    <a href="#architecture">Architecture</a> •
    <a href="#tech-stack">Tech Stack</a> •
    <a href="#roadmap">Roadmap</a> •
    <a href="#development">Development</a>
  </p>
</div>

---

## Overview

Beztack is a monorepo starter for SaaS products that bill customers by subscription. It ships two payment providers behind one interface: [Mercado Pago](https://www.mercadopago.com) for local-currency billing in Latin America and [Polar](https://polar.sh) (a merchant of record) for selling worldwide. You pick the active provider with the `PAYMENT_PROVIDER` environment variable.

On top of checkout and webhooks, the API implements the plan-change flows a B2B product needs: upgrades with a proration preview, downgrades that take effect at renewal, billing cadence changes, a ledger of pending changes, admin tier overrides and an admin retry for failed changes. Auth, organizations, an admin area, email and a docs site are included.

## Quick Start

You need Node.js 22, pnpm 11 and a PostgreSQL database.

```bash
# Scaffold a project (asks for name, default currency and locale)
pnpm create beztack
cd my-app
pnpm install

# Set up environment variables (one file per app)
cp apps/api/.env.example apps/api/.env
cp apps/ui/.env.example apps/ui/.env
cp apps/docs/.env.example apps/docs/.env
# Edit them: at least DATABASE_URL, BETTER_AUTH_SECRET, APP_NAME, DEFAULT_CURRENCY,
# DEFAULT_LOCALE and the credentials of your payment provider

# Create the database tables
pnpm db:migrate

# Start the UI (5173), API (3000) and docs (3002)
pnpm dev
```

`pnpm create beztack` runs the `beztack` CLI, which clones this repository and applies your answers. Its closing "Next steps" message prints `pnpm run push`, which is not a script in this repo. Use `pnpm db:migrate`, or `pnpm db:push` to sync the schema without migration files.

Upgrading a database that already has plans? Migration `0009` rewrites stored prices to integer minor units. Take a `pg_dump` backup first: see [docs/price-migration.md](docs/price-migration.md).

To work on Beztack itself, clone the repository and run `pnpm install && pnpm build:packages` before any test or typecheck. Apps and packages resolve workspace packages through their gitignored `dist` folders.

## Payments

Payments live in `packages/payments`:

| Package                   | Path                             | Role                                                                    |
| ------------------------- | -------------------------------- | ----------------------------------------------------------------------- |
| `@beztack/payments`       | `packages/payments/core`         | Provider-neutral types, the `PaymentProviderAdapter` interface, factory |
| `@beztack/mercadopago`    | `packages/payments/mercado-pago` | Mercado Pago adapter, React components and hooks (English, Spanish)     |
| `@beztack/payments-polar` | `packages/payments/polar`        | Polar adapter on top of the Better Auth Polar plugin                    |

The API (`apps/api`) calls the adapter interface, so routes do not branch on the provider name. Adapters declare capabilities instead. Polar can move a subscription to another billing cadence. Mercado Pago cannot (it cannot change a preapproval's frequency), and the API refuses that case.

What the API implements today:

- **Checkout, subscriptions and webhooks.** `POST /api/subscriptions/checkout`, `GET/PATCH/DELETE /api/subscriptions/:id`, `POST /api/subscriptions/webhooks` and, for Mercado Pago, `POST /api/payments/mercado-pago/webhook`.
- **Plan changes.** Upgrades, downgrades and cadence changes (monthly and yearly) through `POST /api/subscriptions/plan-change/preview` and `.../accept`.
- **Proration preview.** The preview returns the first payment, the credit for the unused part of the current period, and when the change takes effect (after the first payment for upgrades, at the next renewal for downgrades).
- **Pending plan change ledger.** Downgrades and cadence changes are stored in the `pending_plan_change` table (statuses `pending`, `activated`, `canceled`, `failed`) and activated on renewal. Users can read and cancel their pending change (`plan-change/pending`).
- **Failed-change retry.** After five failed activations a change is marked `failed`. App admins list failed changes and requeue them (`GET /api/auth/admin/plan-changes/failed`, `POST /api/auth/admin/plan-changes/:id/retry`), also from the admin page in `apps/ui`.
- **Admin tier overrides.** An App admin can set a tier for a user or organization without charging anything or touching real subscriptions, and clear it (`DELETE /api/membership/admin-tier-override`).
- **Billing target.** `SUBSCRIPTION_MODE` bills each user or each organization (default: organization).
- **Personal organization.** With `SUBSCRIPTION_MODE=organization`, `PERSONAL_ORGANIZATION_ON_SIGNUP` (default `true`) gives each new user an organization they own and makes it their Active organization on every new session. Set it to `false` to have users create organizations by hand; checkout and Plan change then answer `409 organization_required` until they have one.
- **Plan catalog.** Admin routes under `/api/auth/admin/plans` create, import and sync plans between the provider and the local `plan` table.

Not included: a Stripe adapter or any provider beyond these two (the core package is built to take more, see [Payments Core](apps/docs/content/docs/payments/payments-core.mdx)) and a hosted checkout demo.

## Architecture

Three apps, one monorepo.

```
apps/
├── ui/          # Frontend SPA (Vite + React 19, React Router v7)
├── api/         # Backend server (Nitro)
└── docs/        # Landing & documentation (Next.js 16 + Fumadocs)

packages/
├── ai/          # Re-exports the Vercel AI SDK and configures Amazon Bedrock
├── auth/        # Role and redirect helpers shared by API and UI
├── cli/         # `beztack` CLI: create, init, experimental template commands
├── db/          # Drizzle schema, client and SQL migrations (PostgreSQL)
├── email/       # React Email templates, sent with Resend
├── env/         # Environment validation (T3 Env + Zod)
├── ocr/         # Tesseract.js text extraction helper
├── payments/    # core, mercado-pago, polar (see Payments)
└── state/       # URL state parsers (nuqs)
```

### `apps/ui`: frontend SPA

- **Vite**, **React 19**, **Tailwind CSS v4** and **shadcn/ui**
- **React Router v7** for routing, **TanStack Query** for server state
- **i18next** for translations
- Pricing, billing, pending plan change notice and admin pages (users, analytics, plan changes)

### `apps/api`: backend server

- **Nitro** (h3) with file-based routes
- **Better Auth** with email and password, two-factor (TOTP), organizations with teams and invitations, and an admin role
- **Drizzle ORM** on PostgreSQL through `@beztack/db`
- Payments through `@beztack/payments` (see above)

### `apps/docs`: landing and documentation

- **Next.js 16** (App Router) and **Fumadocs** with MDX content in `apps/docs/content/docs`

## Tech Stack

| Category         | Technology                                      |
| ---------------- | ----------------------------------------------- |
| **Monorepo**     | Nx, pnpm workspaces                             |
| **Frontend**     | Vite, React 19, shadcn/ui, Tailwind CSS 4       |
| **Backend**      | Nitro (h3), Drizzle ORM, PostgreSQL             |
| **Auth**         | Better Auth                                     |
| **Payments**     | Mercado Pago, Polar                             |
| **Email**        | React Email, Resend                             |
| **Docs**         | Next.js, Fumadocs                               |
| **Validation**   | Zod, T3 Env                                     |
| **State**        | nuqs, TanStack Query                            |
| **Code quality** | Vite+ (`vp check`: format and lint), TypeScript |
| **Git hooks**    | `vp staged` on pre-commit                       |

## Features

- **Billing** - Mercado Pago and Polar adapters, plan changes with proration preview, pending change ledger, admin tier overrides and failed-change retry (see [Payments](#payments)).
- **Auth** - Better Auth with email and password, two-factor, organizations with invitations, and an admin role.
- **Database** - Drizzle ORM schema and SQL migrations in `packages/db`.
- **Email** - Five React Email templates (welcome, password reset, organization invitation, subscription confirmation and a sample) sent through Resend.
- **Environment validation** - T3 Env schemas for API, UI and docs in `packages/env`.
- **Agent-friendly docs** - `AGENTS.md`, a domain glossary in `CONTEXT.md` and architecture decisions in `docs/adr`.

## Packages

### `@beztack/payments`, `@beztack/mercadopago`, `@beztack/payments-polar`

Provider-neutral payment core plus the Mercado Pago and Polar adapters. See [Payments](#payments).

### `@beztack/env`

Environment variable validation using T3 Env and Zod schemas.

### `@beztack/db`

Drizzle schema, PostgreSQL client and migrations. Scripts: `db:generate`, `db:migrate`, `db:push`, `db:studio`.

### `@beztack/email`

React Email templates and a `sendEmail` helper that uses Resend.

### `@beztack/state`

nuqs parsers for URL state. An example page in `apps/ui` uses them.

### `@beztack/ai`

A thin package: it re-exports the [Vercel AI SDK](https://ai-sdk.dev) and configures an Amazon Bedrock provider (region `us-east-1`, AWS credential chain). No app uses it yet, and the API has no AI routes. Treat it as a starting point.

### `@beztack/ocr`

One helper, `extractTextFromImage`, built on Tesseract.js. The OCR example page in `apps/ui` uses it.

### `beztack` (`packages/cli`)

The CLI behind `pnpm create beztack`: `create`, `init` (choose optional modules) and an experimental `template` command (see [Roadmap](#roadmap)).

## Roadmap

These are not implemented yet. Do not rely on them.

- **Template sync.** Updating a project created from Beztack by receiving reviewed pull requests with template changes. The design is recorded in [ADR 0005](docs/adr/0005-template-sync-engine-requires-build-vs-adopt-gate.md) and [ADR 0006](docs/adr/0006-template-sync-uses-revisions-prs-and-trust-boundaries.md). The repo contains an untested prototype, `beztack template status|plan|apply|rollback|inspect`, that writes straight to your working tree. It is not the planned design.
- **More sign-in methods.** OAuth providers, magic link, passkeys, multi-session, API keys and a breached-password check are not configured (`socialProviders` is empty in `apps/api/server/utils/auth-config.ts`).
- **More payment providers.** Stripe and others.

## Development

### Prerequisites

- Node.js 22 (what CI runs)
- pnpm 11
- PostgreSQL

### Commands

```bash
# Start all apps in development mode
pnpm dev

# Build all apps
pnpm build

# Check formatting and lint (Vite+)
pnpm check

# Type-check every project
pnpm typecheck

# Run tests
pnpm test

# Database: generate SQL from schema changes, apply migrations, push schema, open Studio
pnpm db:generate
pnpm db:migrate
pnpm db:push
pnpm db:studio
```

### NX Commands

```bash
# Run a specific task
npx nx <target> <project>

# Visualize project graph
npx nx graph

# Run affected tasks
npx nx affected -t build
```

## Environment Variables

Each app has its own `.env.example`: `apps/api/.env.example`, `apps/ui/.env.example` and `apps/docs/.env.example`. The API refuses to start without the required ones. The main ones:

```bash
# Database and auth
DATABASE_URL="postgresql://..."
BETTER_AUTH_SECRET="..."
BETTER_AUTH_URL="http://localhost:3000"
APP_NAME="my-app"
APP_URL="http://localhost:5173"

# Regional defaults (required, no built-in default)
DEFAULT_CURRENCY="USD"
DEFAULT_LOCALE="en-US"

# Payments: "polar" or "mercadopago"
PAYMENT_PROVIDER="polar"

# Polar
POLAR_ACCESS_TOKEN="..."
POLAR_WEBHOOK_SECRET="..."

# Mercado Pago (required when PAYMENT_PROVIDER=mercadopago)
MERCADO_PAGO_ACCESS_TOKEN="..."
MERCADO_PAGO_APPLICATION_ID="..."

# Email
RESEND_API_KEY="..."
```

The complete schema is in `packages/env/src/api.ts`.

## Deployment

The API builds with Nitro, which targets Node.js and several hosting presets. The UI is a static SPA, and `apps/ui/vercel.json` holds its Vercel rewrites. The repository does not ship a Dockerfile or Cloudflare configuration yet.

## License

[MIT](./LICENSE)

---

<div align="center">
  <p>A TypeScript starter for SaaS products that bill in LatAm and worldwide.</p>
  <p>
    <a href="https://nx.dev"><img src="https://img.shields.io/badge/NX-143055?style=flat&logo=nx&logoColor=white" alt="NX"></a>
    <a href="https://vitejs.dev"><img src="https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white" alt="Vite"></a>
    <a href="https://react.dev"><img src="https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black" alt="React"></a>
    <a href="https://nitro.build"><img src="https://img.shields.io/badge/Nitro-00DC82?style=flat&logoColor=white" alt="Nitro"></a>
    <a href="https://orm.drizzle.team"><img src="https://img.shields.io/badge/Drizzle-C5F74F?style=flat&logo=drizzle&logoColor=black" alt="Drizzle"></a>
  </p>
</div>
