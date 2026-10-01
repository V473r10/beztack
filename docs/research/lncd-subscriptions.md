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

### `apps/api/server/utils/**`

"Both" = added independently on each side after March (no baseline entry).

| File | Class | Reason |
|---|---|---|
| `plan-change-preview.ts` (lncd-only) | B (+ A pieces) | Superseded as a module by Beztack `plan-change.ts`: it calls provider `listProducts()` + `enrichProductWithCatalog` (MP catalog) instead of a Pricing catalog port, hardcodes `TIER_RANK = {free:0,basic:1,pro:2,ultimate:3,enterprise:3}` (Beztack derives rank from `plan.displayOrder`, which is what #17 story 29 asks), imports `calculateProration` from `@beztack/mercadopago`. **A pieces** worth lifting into Beztack's module: (1) rank-based Billing manager rule -- `ORGANIZATION_ROLE_RANK` + "highest member role >= `billingManagedByRole`", rejecting an unknown threshold with 500 instead of silently denying; Beztack's three plan-change routes use exact `roleListIncludes(memberRole, billingManagedByRole)`, so with `billingManagedByRole = "admin"` an **owner is refused**. Drop lncd's `rider: -1` (ADR-0007, B). (2) Upgrade credit computed from the amount actually billed (`resolveCurrentBillingAmount`, falls back to catalog price) instead of Beztack's catalog `currentPlan.price.amount`, which over/under-credits after a prorated first Payment or a price edit. (3) Current Subscription accepts `trialing`; Beztack's route-level `isCurrentSubscription` does not. |
| `plan-change-acceptance.ts` (lncd-only) | B | Upgrade = MP custom preapproval read back through `metadata.initPoint`, no provider confirmation for Downgrade/Cadence change (stores Pending state directly, the opposite of #17 story 27), and accepts Cadence change although activation only rewrites the amount (see `subscription-projection.ts`). Beztack's `acceptPlanChange` + `PlanChangePaymentAdapter` is the better shape. |
| `pending-plan-change.ts` (lncd-only) | A (store shape) | Keeps the row and moves `status` `pending -> activated \| canceled` with `acceptedByUserId`, `canceledByUserId`, `canceledAt`, `activatedAt`, `metadata.cancelReason` (`user`, `current_subscription_canceled`, `renewal_evidence_failed`). Beztack's store **deletes** the row on cancel and on activation (`pending.delete.ts` store, `subscription-projection.ts:1208` `cancelPendingPlanChange`/`clearPendingPlanChange: deletePendingPlanChange`), so there is no record of who canceled or why. Port the audit columns/semantics into Beztack's `PlanChangeStore`, not lncd's `targetProduct*` column layout (Beztack's `target_plan_snapshot` jsonb is the ADR-0002 "confirmed target snapshot"). |
| `subscription-projection.ts` (both) | A (one piece) | Beztack's is ahead overall (1714 vs 1108 lines; delegates to `activatePendingPlanChange` / `reconcileProviderConfirmedPlanChange` and actually **stores** reconciled Pending state, while lncd only *surfaces* the evidence; skips events the provider boundary hides). **A piece:** on renewal activation lncd calls `providerActions.updateSubscriptionAmount(subscriptionId, pendingPlanChange.targetAmount)` (`:598`) and verifies the provider echoed the new amount (`webhook.post.ts:98`). Beztack's activation only moves Membership, so after a Downgrade the MP preapproval keeps charging the old price. lncd's version is itself incomplete: it updates `transaction_amount` only, so an activated Cadence change keeps the old frequency -- the full fix is lncd's `updateAtEffective` (plan id + amount + frequency). Also generic: projecting `subscription_billing_cadence` onto user/organization. |
| `membership.ts` (both) | A (one piece) | Adds `billingCadence` to `MembershipInfo` (from `user/organization.subscription_billing_cadence`, normalizing `month/annual/year`), which the plan-change UI needs to show the current cadence. Beztack is ahead elsewhere: `source` field and `canUseCachedMembership` (validates cached MP subscription ids, #15 stories 15-16 -- lncd has neither). `requireConsumerAuth` / `isConsumerRole` are B (consumer accounts). |
| `subscription-ownership.ts` (both) | A (one piece) | lncd treats App admin as `sudo` **and** allow-listed email (`app-admin.ts`); Beztack's `hasAdminRole` lets any `"admin"` role own every Subscription. Port that check only (`app-admin.ts` itself is classified by #40). Keep Beztack's organization branch: lncd checks payer email/customer id **before** organization identity, so in organization mode a matching payer email establishes ownership, which #15 story 5 forbids. |
| `billing-access.ts` (lncd-only) | A | `requireOrganizationBillingManagerAccess({auth, organizationId, feature})`: 404 unknown org, App admin passes, else rank rule above, 403 `"<feature> requires Billing manager access"`. Used by subscription list/single/checkout routes and `GET /api/organization/billing-access`. Beztack has no shared gate: the rule is pasted into three plan-change routes, and `subscriptions/index.get.ts` only checks plain organization membership (any member sees the organization's billing). Generic once `rider` is dropped. |
| `admin-tier-override.ts` (both) + test | C | Same module on both sides (108-token diff); lncd only swaps its local `isAppAdminActor` for the shared `app-admin.ts` one. |
| `billing-amount-resolver.ts` (+ test), `subscription-discovery.ts`, `mercadopago.ts`, `payment-events.ts` | C | Formatting only. `billing-amount-resolver.ts` `"UYU"` fallback is identical on both sides. |
| `lifecycle-transition.ts` (+ test) (lncd-only) | B | Order/Delivery "change commits, then announce" module (ADR-0010). Not a Subscription lifecycle despite the name in the scope list. |

_(routes, UI and schema in progress)_

## Class-A pieces vs `packages/payments/core`

_(pending)_

## Hardcoded currency / timezone defaults in the class-A set

_(pending)_

## #17 / #15 stories lncd already solves

_(pending)_
