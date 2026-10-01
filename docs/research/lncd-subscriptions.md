# Research: lncd subscriptions, plan changes and billing (#39)

Map: #37. Sources compared: Beztack `origin/main` @ `e3016d0`, lncd `main` @ `822c038`
(2026-09-30). March baseline: lncd `.beztack/origin.json` (2026-03-28; `projectHash` = lncd,
`templateHash` = Beztack, raw sha256). Comparisons are token-level with whitespace, commas,
semicolons, parentheses and comments ignored, so Biome -> Vite+ formatting does not count;
toolchain-only deltas (`vp pack`/`.mjs` exports, `vite-plus/test` imports, TS 6, dep bumps)
belong to the Vite+ ticket and do not count as substance here.

Classes (map Notes): **A** lncd better and generic, **B** lncd-specific, **C** no substantive
difference. In this area "lncd-specific" also covers lncd code that Beztack has already
superseded (see Context) -- porting it would be a step back.

## Context: two parallel implementations, Beztack is ahead on the core

Both repos built the same domain after March, in parallel (June 2026), from the same ADRs
(lncd `docs/adr/0001-subscription-projection-seam`, `0002-beztack-owned-pending-plan-change`,
`0004-app-admin-tier-overrides...` are near-verbatim copies of Beztack's ADR-0001/0002/0004):

- **Beztack** (`7e8dda7`, 2026-06-06): one deep `apps/api/server/utils/plan-change.ts`
  (898 lines, pure: no `db`, no provider import) behind ports `PlanChangeStore` and
  `PlanChangePaymentAdapter`, with preview, acceptance, Pending Plan change cancellation,
  renewal activation and provider-confirmed reconciliation -- i.e. most of PRD #17 is
  already implemented on `main`, although #18-#26 are still open. Its weakness is the route
  layer: `routes/api/subscriptions/plan-change/{preview,accept}.post.ts`,
  `pending.delete.ts` (412-659 lines each) each re-implement the Drizzle store, App admin
  check, cadence mapping and Current Subscription discovery.
- **lncd** has *two* engines:
  1. `packages/payments/core/src/server/index.ts` (`@beztack/payments/server`): an older
     "Subscription change" engine writing `subscription.pending_*` columns plus
     `subscription_change_history/_retry`, run by `routes/api/subscriptions/changes/apply-due.post.ts`.
     It classifies by **price** (`targetAmount < currentAmount ? downgrade : upgrade`), which
     #17 stories 3-4 explicitly reject.
  2. `apps/api/server/utils/plan-change-{preview,acceptance}.ts` + `pending-plan-change.ts`
     (2026-06-11): tier-rank classification, Pending Plan change table, used by the
     `subscriptions/*` routes. Shallower than Beztack's module: it reads provider products
     directly, imports `@beztack/db`, `@beztack/mercadopago` (`calculateProration`) and
     `catalog-mp` in the module itself, and skips provider confirmation.

So the porting question is mostly "which lncd details improve Beztack's module", not
"port lncd's module".

## Per-file classification

### `packages/payments/**`

| File | Class | Reason |
|---|---|---|
| `packages/payments/core/src/server/index.ts` (lncd-only) | B | Engine 1 above. Price-based direction, no Cadence change, writes `db` from inside the provider-neutral package (makes `@beztack/payments` depend on `@beztack/db` + `drizzle-orm`), `billingCurrency ?? "UYU"` (`:270`), `targetProviderPlanId!`, and `newChangeId()` calls `randomUUID()` **without importing it** (`node:crypto` missing), so `requestSubscriptionUpgrade/Downgrade` would throw `ReferenceError` -- only `cancelPendingSubscriptionChange` and `applyDueSubscriptionChanges` are reachable from routes. Superseded by Beztack `plan-change.ts`. The one idea worth keeping (claim-row-then-apply with `applying`/`failed` status, history + retry rows) is noted under section 2. |
| `packages/payments/core/src/types.ts` | B (+ tiny A) | Adds optional `scheduleDowngrade` / `updateAtEffective` / `cancelScheduledDowngrade` to `PaymentProviderAdapter` -- the hooks of engine 1; the MP implementations of the first and last are no-ops. Tiny A: `Product.highlighted?` / `soon?` (pricing-page flags, travel with `plan.soon`). |
| `packages/payments/core/src/index.ts` | B | Only re-exports the three `Schedule*` option types above. |
| `packages/payments/core/src/react/hooks.ts` | A (small) | Maps `highlighted`/`soon` and sorts tiers by `displayOrder` in `usePricingTiers`. **But** lncd also added two leftover `console.log("product"/"tier")` -- drop those. |
| `packages/payments/core/package.json` | C | Non-toolchain delta is only the `./server` export and `@beztack/db`/`drizzle-orm` deps for the B engine; zod peer `^3 \|\| ^4` rides with Vite+/deps. |
| `packages/payments/core/src/{factory,webhooks}.ts`, `react/index.ts`, `tsconfig.json`, `vite.config.ts` | C | Identical or toolchain-only. |
| `packages/payments/mercado-pago/src/adapter.ts` | B | Beztack is **ahead** here: its MP adapter implements #15 more fully (plan listing scans later pages, cross-Application plan reads/mutations blocked, created plans verified, checkout creates a `preapproval` and verifies its `application_id` instead of appending `external_reference` to a plan `init_point`). lncd's additions are `scheduleDowngrade` (no-op), `updateAtEffective` (PUT preapproval with target plan + amount) and `cancelScheduledDowngrade` (no-op) for engine 1, plus webhook payload enrichment that re-fetches the subscription, redundant with ADR-0001 projection. `updateAtEffective`'s MP call is the reusable bit (section 2). Both keep `currency = "UYU"` defaults (`:407,791` lncd / `:420,766` Beztack). |
| `packages/payments/mercado-pago/src/adapter.test.ts` | C | Beztack has 9 cases vs lncd 6; lncd has none Beztack lacks. |
| `packages/payments/mercado-pago/src/helpers/external-reference.ts` (+ test) | A (MP adapter only, small) | Encodes `cadence` (billingCadence/billingPeriod) in the MP `external_reference`; lncd projection reads it (`subscription-projection.ts:310`) to classify renewals without extra lookups. `chg` (subscriptionChangeId) belongs to engine 1 -- skip. |
| `packages/payments/mercado-pago/src/server/client.ts` | C | Beztack ahead (`paging` on search responses, used by its page scanning). |
| `packages/payments/mercado-pago/src/types.ts` | C | `application_id` typing reshuffle only. |
| `packages/payments/mercado-pago/src/helpers/{proration,status-mapping}.ts`, `i18n/**`, `index.ts`, `react/**`, `server/index.ts`, all their tests, `package.json`, `tsconfig.json`, `vite.config.ts`, `README.md` | C | Identical, test-runner import, or formatting. `react/provider.tsx` `locale = "es-UY"` and `i18n/types.ts` `DEFAULT_LOCALE = "es-UY"` exist on **both** sides. |
| `packages/payments/polar/**` | C | `PresentmentCurrency` cast after an `@polar-sh/sdk` bump and `vp pack` exports: dependency/toolchain. |

_(apps/api, UI and schema in progress)_

## Class-A pieces vs `packages/payments/core`

_(pending)_

## Hardcoded currency / timezone defaults in the class-A set

_(pending)_

## #17 / #15 stories lncd already solves

_(pending)_
