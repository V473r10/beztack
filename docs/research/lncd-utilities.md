# Research: lncd shared utilities and workspace config (#42)

Map: #37. Sources compared: Beztack `origin/main` @ `e3016d0`, lncd `main` @ `822c038`
(2026-09-29). Diffs taken with whitespace ignored; toolchain-only deltas (Biome -> Vite+,
TS 5.8 -> 6.0, nx 21 -> 22, `tsc` -> `vp pack`) are attributed to the Vite+ ticket and do
not count as substance here. Beztack `origin/main` is still on Biome at the time of writing.

Classes (map Notes): **A** lncd better and generic, **B** lncd-specific, **C** no substantive
difference.

## Per-file classification

### lncd-only files

| File | Class | Reason |
|---|---|---|
| `apps/api/server/utils/cron-request.ts` | A | `requireCronSecret({configuredSecret, event, jobLabel})`: unset secret -> 503, bad `x-cron-secret` -> 401. Generic contract for serverless scheduled routes; lncd's own `subscriptions/changes/apply-due.post.ts` still inlines it. Beztack has no cron routes yet but will need this with any scheduled Subscription change worker. |
| `apps/ui/src/lib/api-client.ts` | A | `requestJson<T>` + `ApiError{statusCode,statusMessage,data}` + `apiUrl`, `credentials: "include"`. Beztack hooks (`hooks/use-subscriptions.ts`, admin plan-sync, etc.) each hand-roll `fetch(`${API_URL}...`)` and error parsing. No domain content. |
| `apps/ui/src/lib/query-keys.ts` | A | Port the **pattern** (single owner of TanStack keys, `all()` prefix builders, pure builders on primitives), not the content. Generic families to keep: `subscriptionKeys`, `productKeys`, `organizationKeys`, `userSessionKeys`, `adminKeys`, `aiKeys`. Order/delivery/rider/menu/storefront/customerAddress/phoneVerification families are B. Beztack today scatters literals (`["subscriptions"]`, `["user-session"]`, `["admin","stats"]`, `["teamMembers", id]`...). |
| `apps/ui/src/lib/format-price.ts` | A | `formatPrice(cents, currency)` with symbol map beats Beztack's `app/admin/components/plan-sync/helpers.ts#formatPrice` (`"12.00 UYU"`). Needs rework before port: drop `DEFAULT_CURRENCY = "UYU"` (make currency required / from project config) and replace the `code === "UYU" ? 0 : 2` special case with `Intl.NumberFormat(...).resolvedOptions().maximumFractionDigits` or a per-currency table. |
| `apps/ui/src/lib/format-time.ts` | A | `formatRelativeFromNow(iso, language)` / `resolveLocale` over date-fns `en`/`es`; matches Beztack's `lib/i18n/locales/{en,es}.json` and Beztack already depends on date-fns. Only lncd consumer is `public/board/orders-kitchen.tsx`, so port on first generic need. |
| `apps/ui/src/lib/browser-navigation.ts` | A | `redirectToExternalUrl(url)` seam so tests can mock checkout redirects (`delivery-checkout.test.tsx`). Beztack has 4 raw `window.location.href =` checkout redirects (`use-subscriptions.ts:136`, `membership-context.tsx:328`, `mercado-pago/subscription-form.tsx:99,103`) that are untestable today. |
| `portless.json` | A | Portless dev-proxy config (per-app `appPort`/`proxy:false`) + root `dev:portless` script and per-app `dev:portless` that prebuilds `@beztack/api^...`. Generic dev ergonomics; drop `packages/sms` entry. Optional; see Open questions. |
| `apps/api/server/test-support/customer-address-database.ts` | B | Hand-written PGlite DDL for `customer_address` (default country `'UY'`). Domain. The **technique** (PGlite + hand-written DDL slice) is noted under Open questions. |
| `apps/api/server/test-support/customer-notification-database.ts` | B | PGlite DDL for order/delivery/push tables (`currency DEFAULT 'UYU'`). Domain. |
| `apps/api/server/utils/seed-demo-data.ts` | B | Restaurant menu seed (sections/collections/products/promotion keyed by `OrganizationBusinessType`). Pure lncd domain. |
| `apps/api/server/utils/timezone.ts` | B | `formatDateInTimezone(date, tz)` (en-CA -> `YYYY-MM-DD`), 8 lines, only consumer is `order-lifecycle.ts` daily order numbering. Trivial to rewrite if Beztack ever needs it. |
| `apps/api/server/utils/client-ip.ts` | B | `extractClientIp` returns first `x-forwarded-for` hop, which is client-spoofable unless behind a trusted proxy; only consumer is lncd's address-resolve rate limit. Do not port as-is; a generic version would need h3 `getRequestIP(event, {xForwardedFor})` + trusted-proxy config. |
| `beztack.template.json` | B | Exists on both sides; lncd's adds `custom-owned` paths and `customZones` for Template Sync. Template Sync was dropped (#36), so nothing to port; Beztack's own copy is now dead config (see Open questions). |

### Files changed on both sides

| File | Class | Reason |
|---|---|---|
| `.env.example` (root) | A | Adds `APP_ADMIN_EMAILS`, `CORS_ORIGINS`, `VITE_MERCADO_PAGO_PUBLIC_KEY` (with the "UI env refuses to load without it" note), `MERCADO_PAGO_INTEGRATOR_ID`. B parts: `APP_NAME=lncd`, provider default flipped to `mercadopago` (Beztack must not pick a default; the CLI asks). |
| `apps/api/.env.example` | A | Generic: `APP_ADMIN_EMAILS`, `CORS_ORIGINS`. B/deferred: AWS SNS (`AWS_REGION=sa-east-1`, sender id) and `PHONE_VERIFICATION_*` belong to the doubtful `packages/sms` area; `PAYMENT_PROVIDER=mercadopago` default is B. |
| `packages/env/src/api.ts` | A | Port: `URL_LIST_SCHEMA` + `CORS_ORIGINS` (replaces Beztack's hardcoded origin arrays in `apps/api/server/plugins/cors.ts` and `utils/auth.ts#trustedOrigins`, which lncd's `plugins/cors.ts` and `auth.ts` now read from env); `*_CRON_SECRET` pattern (pairs with `cron-request.ts`); `APP_ADMIN_EMAILS` moved (Beztack already has it). B/deferred: VAPID, AWS SNS, phone verification, `MAPCN_TILES_URL`, `UPLOADTHING_TOKEN: min(1)` (required!), `PAYMENT_CREDENTIALS_KEY` (payments research), order/delivery cron secrets and minute windows, `PAYMENT_PROVIDER` default `mercadopago`. Keep Beztack's `NODE_ENV` (lncd removed it and reads `process.env.NODE_ENV` directly in `guest-session.ts`, `phone-verify.ts` -- a regression). |
| `AGENTS.md` | A | lncd grew 13 -> 153 lines. Generic sections to port (after Vite+ lands): "Repo Shape", "Module Shape" (`contract.ts`/`index.ts`/`implementation.ts`/`internal/`/`test-database.ts` + "when not to reach for it"), "Commands" (run app suites from inside the app dir, import from `vite-plus/test` not `vitest`, `typecheck` must not be the `@nx/js` `echo` stub), "Database And Env". B: `V473r10/lncd` + Linear tracker line, references to lncd ADR numbers and `address-resolution`. |
| `package.json` (root) | A | Beyond toolchain (Vite+ ticket: `vp lint/fmt/check`, drop biome/ultracite/lefthook/lint-staged, TS 6, nx 22.6.3): `"test": "nx run-many -t test"` replaces `nx test` (which needs a project). `dev:portless` rides with `portless.json`. `name`/`description` are B. |
| `pnpm-workspace.yaml` | C | Only `allowBuilds` differs, and every change follows the toolchain (biome/lefthook gone) or lncd deps (`msgpackr-extract`, `@prisma/client`/`better-sqlite3` removal). Regenerate with the Vite+ migration, not by copy. |
| `apps/ui/tsconfig.app.json` | A | `paths` for `@beztack/payments`, `/react`, `@beztack/mercadopago`, `/react`, `@beztack/payments-polar/auth-client`, `@beztack/env/ui` pointing at package **source**, mirroring lncd `apps/ui/vite.config.ts` aliases -> UI typechecks/dev without prebuilt `dist`. Drops `references` to `packages/{state,ocr,env,ai}`. `ES2022` + `types: ["vite-plus/client"]` + `ignoreDeprecations: "6.0"` are toolchain. |
| `packages/db/package.json` | A | `./schema` export; `build: "tsc --build"` + project-scoped `nx.targets.build.dependsOn: ["^build"]` (rationale in lncd AGENTS.md: `src/client.ts` imports `@beztack/env/db` via built `dist`; `^build` cannot go in `nx.json` because payments<->mercadopago is circular); `dotenv`, `@types/node`; drizzle-orm 0.45.2 / drizzle-kit 0.31.10. |
| `packages/payments/core/package.json` | A | New `./server` export (`src/server/index.ts`: `SubscriptionChange*` types, apply-due engine) + deps `@beztack/db`, `drizzle-orm`; zod peer `^3 \|\| ^4`; `.mjs` via `vp pack`. Generic in shape, but whether `./server` is ported is owned by the subscriptions research/grilling (ADR 0001/0002), and `server/index.ts:270` defaults `billingCurrency` to `"UYU"`. |
| `packages/db/drizzle/meta/**` | B | Journals are unrelated lineages (see Schema history). Never copy. |

Counts: **A 15, B 7, C 1** (23 entries; `test-support/**` counted as its 2 files, `drizzle/meta/**` as one).

## Hardcoded currency / timezone / locale defaults

In scope files:
- `apps/ui/src/lib/format-price.ts`: `DEFAULT_CURRENCY = "UYU"`, UYU-only 0 decimals.
- `apps/api/server/utils/timezone.ts`: `"en-CA"` used as a date-format trick (fine, not a default).
- `test-support/*`: DDL defaults `'UY'`, `'UYU'`.
- `.env.example` / `apps/api/.env.example`: `PAYMENT_PROVIDER=mercadopago`, `AWS_REGION=sa-east-1`.
- `packages/env/src/api.ts`: `PAYMENT_PROVIDER` default `"mercadopago"`.
- `packages/db/src/schema.ts`: `organization.currency DEFAULT 'UYU'`, `organization.timezone DEFAULT 'America/Montevideo' NOT NULL`, `customer_address.country DEFAULT 'UY'`.

Elsewhere in lncd (generic code, relevant to what gets ported later):
- `apps/api/server/utils/billing-amount-resolver.ts:49` `"UYU"` fallback -- **also present in Beztack** (`:54`).
- `packages/payments/core/src/server/index.ts:270` `billingCurrency ?? "UYU"`.
- `packages/payments/mercado-pago/src/adapter.ts:407,791` `currency = "UYU"`, `MERCADO_PAGO_CURRENCY ?? "UYU"` -- **also in Beztack** (`:420,766`); `react/provider.tsx:71` `locale = "es-UY"`.
- `apps/api/server/routes/api/payments/mercado-pago/webhook.post.ts:42` `currency_id ?? "UYU"` (Beztack: `subscription-projection.ts:1599`).
- UI: `hooks/use-org-settings.ts:27` `?? "UYU"`, `app/private/home/use-home-data.ts:23`, `hooks/use-subscription-details.ts:246` `Intl.NumberFormat("es-AR")`, `app/private/billing/subscription-welcome.tsx:273` `toLocaleDateString("es-AR")`.
- Domain (B): `order-lifecycle.ts:343,578`, `orders.ts:59` `"UY"`, `orders/settings.patch.ts:61`.

Implication: Beztack already carries `"UYU"` defaults in `billing-amount-resolver.ts`, the MP adapter and `subscription-projection.ts`; removing them is Beztack work regardless of what is ported. Proposed shape: one project-level config (`DEFAULT_CURRENCY`, `DEFAULT_TIMEZONE`, `DEFAULT_LOCALE` in `packages/env`, asked by the `create` CLI) with no baked-in value, consumed by the UI formatters, the MP adapter and billing resolvers.

## Schema history

- March baseline (`.beztack/origin.json`, 2026-03-28): both repos shared `packages/db/drizzle/0000_tricky_slipstream` .. `0004_hesitant_killraven` (plus a legacy `apps/api/drizzle/` copy).
- Both then **reinitialized independently**: lncd `0000_initial` (added 2026-04-26, `ac77879`), Beztack `0000_mixed_callisto` (2026-05-30, `e602d7f`). No shared snapshot id; `0000` snapshot ids `ef2bafdb` (lncd) vs `151a4cda` (Beztack).
- Beztack: 3 migrations, 17 tables (`0001_flimsy_toad`, `0002_exotic_human_fly` add admin tier override and `pending_plan_change`).
- lncd: 17 journal entries (`0000`..`0016`, no `0005`, two `0008_*`), 42+ tables. Its meta is internally inconsistent: snapshots exist only for 0000-0004, 0006-0008, 0011-0013; `0007_snapshot.prevId` (`77a5b76a`) does not match `0006_snapshot.id` (`63bf8162`); 0014-0016 (`delivery_recovery`, `cod_settlement`, `customer_order_notifications`) have no snapshot. So lncd's latest snapshot is not even a trustworthy diff base for lncd.

Generic deltas on shared tables (lncd latest snapshot vs Beztack `0002`), i.e. what would have to be **regenerated** in Beztack from an edited `packages/db/src/schema.ts` via `pnpm db:generate`:
- All timestamps `timestamp` -> `timestamp with time zone` (account, session, verification, user, organization, member, invitation, team, team_member, plan, payment, webhook_log, admin_tier_override*). Generic, arguably A; needs a `USING ... AT TIME ZONE 'UTC'` review because drizzle emits a plain `ALTER COLUMN TYPE`.
- `subscription`: `pending_change_id`, `pending_change_type`, `pending_effective_at`, `pending_status`, `pending_target_plan_id`, `pending_target_tier` + two indexes (ADR 0001 projection seam).
- `pending_plan_change`: incompatible reshape (lncd `target_type/target_id/target_product_id/target_tier/target_amount/target_currency/provider/provider_subscription_id/...` vs Beztack `membership_target_*`, `target_plan_snapshot`, `provider_confirmed_plan_change_id`) -- ADR 0002; decided by the subscriptions grilling, not here.
- `webhook_log`: lncd `provider_event_id` + unique(`provider`,`provider_event_id`) vs Beztack `event_key` unique -- pick one in payments research.
- `user.subscription_billing_cadence`, `organization.subscription_billing_cadence`, `plan.soon`: small generic columns, travel with subscriptions.
- `organization.currency`/`timezone`: generic idea, but must land without the UYU/Montevideo defaults.
- B (never port): `organization.business_type`, `ordering_enabled`, `delivery_*`, `cash_on_delivery_enabled`, `theme`/`color_theme`, and the 25 lncd-only tables (menu, order, delivery, rider, push_subscription, customer_address, restaurant_table, guest_session, `organization_payment_credentials`, `user_phone_verification`, `subscription_change_history`/`_retry`...). `subscription_change_*` and `organization_payment_credentials`/`push_subscription`/`user_phone_verification` are decided by the subscriptions, payments and doubtful-areas tickets.

Rule for porting: edit Beztack `packages/db/src/schema.ts` by hand, one area at a time, run `db:generate` to get a new Beztack-lineage migration, review the SQL (especially timestamptz casts and the `pending_plan_change` reshape, which needs a data migration or a drop if no production data). lncd `.sql` files are reference only.

## Top recommendations

1. Port together as one "API scaffolding" slice: `cron-request.ts` + `*_CRON_SECRET` env pattern, `CORS_ORIGINS` (`URL_LIST_SCHEMA`) replacing Beztack's hardcoded origin lists in `plugins/cors.ts` and `auth.ts`, matching `.env.example` entries.
2. Port as one "UI data layer" slice: `api-client.ts`, a trimmed `query-keys.ts` (generic families only, migrate existing literal keys), `browser-navigation.ts`.
3. Currency/timezone/locale become project config with no default; fix Beztack's existing `"UYU"` fallbacks at the same time; `format-price.ts` ported only after that.
4. After Vite+ lands: `packages/db/package.json` build/exports shape, `apps/ui/tsconfig.app.json` source `paths`, root `test` script, and the generic AGENTS.md sections.
5. Schema: regenerate, never copy; timestamptz switch is the only purely generic schema change; the rest rides with subscriptions/payments decisions.

## Open questions

- Portless: does Facundo want it in the template (extra dev dependency, named `.localhost` URLs), or stay with plain ports?
- The PGlite hand-written-DDL test technique (`test-support/*`, `domain/*/test-database.ts`): worth a generic `test-support` helper in Beztack? It needs `@electric-sql/pglite` as an api devDependency; lncd's own comment admits every new column must be mirrored by hand (Postgres 42703 on drift).
- `beztack.template.json` in Beztack is Template Sync config and Template Sync is dropped (#36): delete it from Beztack? (Out of this ticket's port scope.)
- `packages/payments/core` `./server` export: port with the subscriptions area or keep subscription-change logic in `apps/api`? Owned by the subscriptions grilling.
- Timestamptz migration: are there live Beztack-derived databases whose `timestamp` columns would need a data-preserving cast?
- `client-ip`: if Beztack later needs rate limiting, which trusted-proxy model (Vercel headers vs `x-forwarded-for`)? Not determinable from code.
