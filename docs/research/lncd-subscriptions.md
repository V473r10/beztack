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

### `apps/api/server/routes/api/**`

| File | Class | Reason |
|---|---|---|
| `subscriptions/[id].get.ts`, `[id].delete.ts` | A (gate only) | In organization mode both call `requireOrganizationBillingManagerAccess` (`feature: "Subscription detail" / "Subscription cancellation"`). Beztack lets any `isSubscriptionOwnedByUser` caller read or cancel the organization's Subscription. |
| `subscriptions/[id].patch.ts` | B (+ gate) | lncd still routes `productId` plan changes through PATCH into `acceptPlanChange`; Beztack answers 410 and sends callers to `plan-change/*` (#17 stories 40-41 -- Beztack is ahead). The Billing manager gate on status changes rides with `billing-access.ts`. |
| `subscriptions/checkout.post.ts` | A (gate only) | Adds the Billing manager gate (`feature: "Checkout"`) in organization mode. Otherwise Beztack ahead (`checkout-callback-urls.ts`); both reject `upgrade` (lncd 400, Beztack 410) and both refuse yearly on MP. |
| `subscriptions/index.get.ts` | A | Organization listing behind the Billing manager gate (Beztack: any member) and each Subscription returned with its `pendingPlanChange` (`direction`, `effectiveAt`, `targetTier`, `targetBillingCadence`, `targetAmount/Currency`). Beztack has no read path for Pending Plan change at all -- the UI cannot show "Downgrade to Basic on 2026-11-01" or offer to cancel it. #17 deliberately has no "Pending Plan change query Interface"; this would be a projection read in the route/store, not a module method. |
| `subscriptions/products.get.ts` | C | Identical. |
| `subscriptions/webhooks.post.ts` | B | Beztack ahead: provider-neutral envelope (`createProjectionEventEnvelopeFromWebhookPayload`, `deliveryId`), 500 on `failed` outcome. lncd re-parses the raw body to derive `providerEventId`. |
| `payments/mercado-pago/webhook.post.ts` | A (one piece) | `providerActions.updateSubscriptionAmount` (PUT preapproval `transaction_amount`, then fail if MP did not echo the amount) -- the provider half of the renewal-activation fix above. Otherwise lncd moved MP-specific mapping into the route and adds `currency_id ?? "UYU"` (`:42`); Beztack's route is thinner. |
| `payments/mercado-pago/webhook/[orgId].post.ts` (lncd-only) | B | Restaurant order payments with per-organization MP credentials; scope of #41. |
| `subscriptions/preview-upgrade.get.ts` (lncd-only) | B | Upgrade-shaped preview; Beztack replaced it with `plan-change/preview.post.ts` (#17 stories 40-41). |
| `subscriptions/[id]/pending-plan-change.delete.ts` (lncd-only) | B (+ A detail) | Equivalent of Beztack `plan-change/pending.delete.ts`. A detail: records `canceledByUserId` and reason via the A store above. Authorization repeats the rank rule inline. |
| `subscriptions/changes/apply-due.post.ts`, `changes/[changeId]/index.delete.ts` (lncd-only) | B | Engine 1 (`@beztack/payments/server`). `apply-due` inlines the cron-secret check that #42 already proposes as `cron-request.ts`. |
| `organization/billing-access.get.ts` (lncd-only) | A | `GET` -> `{ isBillingManager, memberRole, organizationId, billingManagedByRole }` for the active organization; feeds `use-billing-access.ts` / `billing-manager-route.tsx`. |
| `membership/status.get.ts` | C | Ignores `organizationId` outside organization mode and swaps to the shared `app-admin.ts` (#40). |
| `membership/user.get.ts`, `membership/organization/[id].get.ts` | B | Add engine 1's `pendingChange` from `subscription.pending_*` columns. |
| `membership/admin-tier-override.delete.ts` | C | Shared `app-admin.ts` swap only. |
| `admin/plans/**` (Beztack: `auth/admin/plans/**`) | A (small) / C | `index.post.ts`, `[id].patch.ts` accept `soon` (with `highlighted`) -> rides with `plan.soon` and core `Product.soon`; lncd also makes `canonicalTierId` non-nullable on patch. `[id].delete.ts`, `import.post.ts`, `index.get.ts`, `sync-status.get.ts`, `sync.post.ts`: C. Beztack moved the folder under `auth/` (`a494320`). |

### `apps/api/lib/payments/**`

| File | Class | Reason |
|---|---|---|
| `catalog-mp.ts`, `catalog.ts` | A (small) | Carry `soon` alongside `highlighted` from DB plans into products; same slice as `plan.soon`. |
| `index.ts` | B | Drops Beztack's `env.PAYMENT_PROVIDER ?? "polar"` fallback because lncd's env defaults to `mercadopago` (#42: a template must not pick a default; the CLI asks). |
| `config.ts`, `types.ts`, `sync.ts`, `README.md` | C | Identical or formatting. |

### `apps/ui/src/**` (billing)

lncd moved billing pages under `app/private/` (Beztack: `app/`); compared by role. Pure
`queryKeys` / `useTranslation` swaps follow #42's query-keys and i18n recommendations and are
not counted here.

| File | Class | Reason |
|---|---|---|
| `components/payments/billing-dashboard.tsx` | A | `PendingPlanChangeNotice` with "Cancel Pending Plan change" button; usable-subscription rule includes `trialing`; when two subscriptions overlap (old one still in paid period) prefers the non-`proratedDowngrade` one. Beztack's UI never reads or cancels a Pending Plan change (no caller of `plan-change/pending.delete.ts`). |
| `components/payments/membership-badge.tsx` (+ test) | A | Shows "Changes to {tier} {cadence} on {date}" when a Pending Plan change exists. Date via bare `toLocaleDateString()` -- fine (user locale). |
| `components/payments/pricing-card.tsx` | A | `period_change` plan-change type ("Switch Billing" + `RefreshCw`) so a same-tier cadence move is a first-class action (#17 story 5), and `soon` tiers rendered disabled. Port fix: the "Próximamente" badge text is hardcoded Spanish JSX, not a `t()` key. |
| `components/payments/plan-change-dialog.tsx` | A (behaviour) / B (endpoint) | Fetches the server preview (`useQuery` on `/api/subscriptions/preview-upgrade`) and shows its error instead of computing `priceDiff` on the client like Beztack -- preview is the authority (#17 stories 1-2). Point it at Beztack's `plan-change/preview.post.ts`; the lncd endpoint is B. |
| `components/payments/upgrade-dialog.tsx` | B | Beztack is ahead: it already calls `plan-change/preview` and merges server preview with the client estimate for all three directions. lncd's version reads the old Upgrade-shaped endpoint; its only extra is defaulting the cadence toggle to the current `billingCadence` (rides with `membership.ts`). |
| `contexts/membership-context.tsx`, `contexts/membership/membership-types.ts` | A (state) / B (wiring) | A: `PendingPlanChange` type, `pendingPlanChange(s)`, `billingCadence`, `cancelPendingPlanChange`, `getPlanChangeType(tier, cadence)` returning `period_change`, `trialing`/`unpaid` statuses, and subscription/membership query keys **scoped by `activeOrganizationId`** (Beztack's `["subscriptions","list"]` key is shared across organizations, so switching organization can show the previous one's billing until refetch). B: accepts plan changes via `PATCH /api/subscriptions/:id` and previews via `preview-upgrade` instead of Beztack's `plan-change/accept`. |
| `hooks/use-billing-access.ts` (lncd-only) | A | `useBillingAccess()` / `useIsBillingManager()` over `GET /api/organization/billing-access`. |
| `components/billing-manager-route.tsx` (lncd-only) | A | Route gate on Billing manager (not owner/admin), so `billingManagedByRole = "member"` works. Port fix: redirects to lncd's `/auth/restaurant/sign-in`. |
| `components/admin-tier-override-banner.tsx` (+ test) | C | Identical (1 token). |
| `app/private/billing/billing.tsx` | A (with dashboard) | Passes `pendingPlanChange` / cancel handler to the dashboard; strings moved to i18n keys (Beztack hardcodes English). |
| `app/private/billing/pricing.tsx` | C | Visual rework (Beztack keeps an FAQ accordion, lncd drops it) plus cadence-aware `getPlanChangeType`, already covered by `pricing-card.tsx`. |
| `app/private/billing/checkout-success.tsx`, `subscription-welcome.tsx` | A (i18n only) / B | Strings to `t()` keys (Beztack mixes hardcoded English and Spanish, e.g. "Suscripcion no encontrada"). B: "create restaurant" CTA, `/organizations` redirect. |
| `app/private/billing/checkout-confirm.tsx` (lncd-only) | A (optional) | `/checkout-confirm?tier=&billingPeriod=` resumes the plan picked before sign-up (`sign-up/components/form.tsx:95`). Port fix: local `formatCurrency` hardcodes `"en-US"` and `?? "USD"`. |
| `app/private/home/components/subscription-card.tsx` (lncd-only) | B | lncd dashboard home card. |
| `billing-plan-change-ui.test.ts` (lncd-only) | B | Asserts source text with `readFile` (`toContain("/api/subscriptions/preview-upgrade")`, restaurant routes). Brittle; not a pattern to port. |
| `app/private/admin/components/plan-sync/**` | A (small) / C | `create-plan-sheet.tsx`, `plan-edit-card.tsx`, `types.ts`, `constants.ts`: `soon` toggle (slice with `plan.soon`). `plan-sync-screen.tsx`, `hooks.ts`, `synced-plan-card.tsx`, `diff-table.tsx`, `helpers.ts`: i18n/query-keys only -> C here (`helpers.ts#formatPrice` is #42's `format-price.ts` item). |
| `components/payments/{usage-metrics,index}.tsx/ts`, `components/payments/mercado-pago/**`, `components/payment-provider-wrapper.tsx`, `contexts/membership/tier-config.ts`, `hooks/{use-payment-events,use-subscriptions,use-subscription-details}.ts`, `types/{pricing,polar-pricing}.ts` | C | Identical or query-key swaps. `use-subscription-details.ts:246` `Intl.NumberFormat("es-AR")` is on both sides. |
| `app/public/**` checkout, `features/delivery/**`, `app/private/orders/**` pricing files | B | Order/delivery domain, picked up by the filename filter only. |

### `packages/db/src/schema.ts` (payment parts)

Regenerate, never copy (see #42 "Schema history").

| Change | Class | Reason |
|---|---|---|
| `pending_plan_change`: `accepted_by_user_id`, `canceled_by_user_id`, `canceled_at`, `activated_at`, `metadata` (cancel reason), status kept instead of row delete | A | Audit of who accepted/canceled and why. Keep Beztack's `target_plan_snapshot` jsonb and `provider_confirmed_plan_change_id`; do not adopt lncd's flattened `target_product_id/target_tier/target_amount/target_currency` (it loses `tierRank`/`id` of the confirmed snapshot) or `serial` id. |
| `user/organization.subscription_billing_cadence` | A | Backs `MembershipInfo.billingCadence`. |
| `plan.soon` | A (small) | Pricing "coming soon" flag. |
| `subscription.pending_*` (6 columns + 2 indexes), `subscription_change_history`, `subscription_change_retry` | B | Engine 1. If Beztack wants durable retries for renewal activation, design it inside the Plan change store, not as these columns. |
| `webhook_log.provider_event_id` + unique(`provider`,`provider_event_id`) vs Beztack `event_key` | C | Same idempotency guarantee, different key shape; Beztack's works. |
| `organization_payment_credentials` | B | Per-organization MP credentials for restaurant orders; #41. |
| `organization.currency DEFAULT 'UYU'`, `organization.timezone DEFAULT 'America/Montevideo'` | B (as written) | Generic idea, but only as project config without defaults (section 3). |

## Class-A pieces vs `packages/payments/core`

Beztack's Plan change logic lives in `apps/api/server/utils/plan-change.ts` behind its own
ports, not in `packages/payments/core`. That is the right home for the domain rules (they
need the DB, auth roles and the Pricing catalog, which a provider package must not know).
"Fits core" below therefore means: the provider-facing half is expressible through the
provider-neutral `PaymentProviderAdapter` (so a Polar project gets it), and the rest stays
in the API module.

| A piece | Where it goes | Core interface needed |
|---|---|---|
| Renewal activation applies the target plan at the provider (`subscription-projection.ts:598` + `webhook.post.ts:98`, completed with `updateAtEffective`'s plan id + frequency) | **Core.** Beztack `activatePendingPlanChange` gains a provider step through its `PlanChangePaymentAdapter`/projection deps; the MP adapter implements it. | Core already has `updateSubscription(id, { productId, prorationBehavior })`, but Beztack's MP adapter ignores `productId` (only `status`). Define it as "switch the recurring plan from the next charge": MP = PUT `/preapproval/{id}` with `preapproval_plan_id`, `auto_recurring.transaction_amount/currency_id/frequency/frequency_type`, then verify the echo and `application_id`; Polar = native `subscriptions.update({ productId, prorationBehavior: "none" })`. The existing `adjustSubscriptionAmount` after a prorated Upgrade is the amount-only case of the same call. No new `scheduleDowngrade`-style hooks: lncd's are no-ops on MP. |
| Rank-based Billing manager rule + `requireOrganizationBillingManagerAccess` + `GET /api/organization/billing-access` + `use-billing-access.ts` + `billing-manager-route.tsx` | **API/UI only** (auth domain, not provider). Becomes the single implementation behind Beztack's `PlanChangeStore.isBillingManager` and the subscription list/get/delete/checkout routes. Coordinate with #40/#45 (roles), which own `app-admin.ts` and role ranks. | None. |
| Upgrade credit from the amount actually billed | **API module**, using the provider-neutral `Subscription` metadata via `billing-amount-resolver.ts` (already in Beztack). | None new: `getSubscription` + `getProduct` suffice. `calculateProration` must not be imported from `@beztack/mercadopago` (lncd does); Beztack's internal calculation stays. |
| Pending Plan change audit (accepted/canceled by, timestamps, reason, keep row) | **API store + schema.** Provider-agnostic. | None. |
| Pending Plan change read path (`index.get.ts` `pendingPlanChange`, `membership-context` state, `billing-dashboard` notice + cancel, `membership-badge` label, `billing.tsx`) | **API route/store + UI.** | None. |
| `billingCadence` in `MembershipInfo` + `subscription_billing_cadence` projection | **API + schema.** Cadence is derived from provider-neutral `Product.interval/intervalCount` (lncd already normalizes `month x 12` as yearly). | None. |
| Organization-scoped query keys in `membership-context` | **UI.** Rides with #42's query-keys slice. | None. |
| `period_change` plan-change type in `pricing-card` / `getPlanChangeType` | **UI.** Note MP currently refuses Cadence change acceptance in Beztack (#17 story 24) and refuses yearly checkout, so the button must reflect provider support. | A capability flag would help: e.g. `PaymentProviderAdapter.capabilities?.cadenceChange` (or an outcome from preview) so the UI can hide "Switch Billing" for MP without hardcoding provider names. |
| Server-authoritative preview in `plan-change-dialog.tsx` | **UI**, pointed at `plan-change/preview.post.ts`. | None. |
| `soon` flag (`plan.soon`, core `Product.soon`, catalog, admin plan-sync, `usePricingTiers`, pricing card) | **Core types** (`Product.soon?`, next to existing `highlighted?`) + DB + UI. Provider-neutral: comes from Beztack's DB plan, not the provider. | Add `soon?: boolean` to `Product`/`PricingTier` in core. |
| `cadence` in MP `external_reference` | **MP adapter only.** Polar carries metadata natively. | None. |
| App admin = `sudo` + allow-listed email in `subscription-ownership.ts` | **API** (`app-admin.ts`, owned by #40). | None. |
| `checkout-confirm.tsx` resume-after-sign-up | **UI** (optional). | None. |
| i18n of billing pages | **UI** (rides with #42's i18n/locale work). | None. |

Not ported, but worth one idea for the subscriptions grilling: engine 1's `applyDueSubscriptionChange`
claims the row (`pending_status = "applying"`), applies, and on failure records `failed` +
a `subscription_change_retry` row. Beztack activates only from webhook evidence, so a failed
provider write at renewal currently has no retry path besides the webhook log.

## Hardcoded currency / timezone defaults in the class-A set

None of the class-A pieces introduces a new `UYU` / `America/Montevideo` default; the ones
they touch are:

- `apps/api/server/routes/api/payments/mercado-pago/webhook.post.ts:42` `currency: payment.currency_id ?? "UYU"` -- in the route that carries the A `updateSubscriptionAmount` action (Beztack's equivalent fallback is `subscription-projection.ts:1599`).
- `apps/api/server/utils/billing-amount-resolver.ts:49` `"UYU"` fallback (comment: "matches the current deployment (Uruguay)") -- used by the A "credit from billed amount" piece; **identical in Beztack** (`:54`).
- `packages/payments/mercado-pago/src/adapter.ts:407,791` `currency = "UYU"`, `MERCADO_PAGO_CURRENCY ?? "UYU"` -- the adapter that would implement the provider half of renewal activation; **identical in Beztack** (`:420,766`).
- `apps/ui/src/components/payments/pricing-card.tsx:382` `formatCurrency(amount, currency = "USD")` with `Intl.NumberFormat("en-US")` -- **identical in Beztack** (`:376`); the A `soon` badge next to it hardcodes `"Próximamente"` (`:206`, a locale string, not via `t()`).
- `apps/ui/src/app/private/billing/checkout-confirm.tsx:29-30,95` `currency = "USD"`, `"en-US"`, `?? "USD"`.
- `apps/ui/src/contexts/membership-context.tsx:443` `currency: "USD"`, `amount: 0` placeholder in the plan-change result.
- `apps/ui/src/app/private/billing/subscription-welcome.tsx:273` `toLocaleDateString("es-AR")` (Beztack same file, same call).
- Schema (if `organization.currency`/`timezone` are ever ported): `DEFAULT 'UYU'`, `DEFAULT 'America/Montevideo' NOT NULL`; lncd uses `timezone` only for daily order numbering (B).
- `packages/payments/core/src/server/index.ts:270` `billingCurrency ?? "UYU"` is in the B engine (not ported).

Dates in the A UI pieces (`billing-dashboard`, `membership-badge`, `plan-change-dialog`) use
bare `toLocaleDateString()` (browser locale) -- acceptable. No timezone is hardcoded in the
class-A set. Recommendation as in #42: one project-level `DEFAULT_CURRENCY` / `DEFAULT_LOCALE`
(no baked-in value, asked by the CLI), and let the price's own currency win wherever a
product or payment carries one.

## #17 / #15 stories lncd already solves

Status for lncd; Beztack `main` given for contrast because Beztack already implements most of
#17 in `plan-change.ts` (so "lncd solves it" rarely means "port lncd's version").
F = full, P = partial, N = no.

### #17 Deepen Plan change decisions

| # | lncd | Beztack main | Note |
|---|---|---|---|
| 1 preview before accepting | F | F | |
| 2 preview = acceptance rules | F | F | lncd accept calls `previewPlanChange` |
| 3-4 Upgrade/Downgrade by tier rank | P | F | lncd rank is a hardcoded map (`TIER_RANK`), engine 1 still classifies by price |
| 5 Cadence change direction | F | F | |
| 6 same tier+cadence rejected | F | F | |
| 7 Upgrade credits unused value | F | F | lncd credits the billed amount (A) |
| 8 Membership up after Payment | F | F | |
| 9 Downgrade keeps access until period end | F | F | |
| 10 Cadence change at renewal | P | N (unsupported) | lncd accepts and activates but only changes the MP amount, not frequency |
| 11 cancel Pending before renewal | F (API + UI) | P (API only) | lncd UI notice/cancel is A |
| 12-13 one Pending, newest replaces | F | F | |
| 14 confirmed target snapshot at renewal | F | F | lncd flattened columns; Beztack jsonb snapshot |
| 15 Reconciling Plan change state | P | F | lncd only surfaces evidence |
| 16 missing Current Subscription fails | F | F | |
| 17 Payment integration mismatch fails closed | P | F | lncd relies on adapter filtering only |
| 18-20 Billing manager preview/accept, authz in module | F | P | Beztack exact-role match (owner refused when threshold is `admin`), rule duplicated in 3 routes |
| 21 App admin real changes | F | F | |
| 22 Admin tier override separate | F | F | |
| 23 MP Application isolation in Plan change | F | F | |
| 24 MP Cadence change acceptance fails clearly | N | F | lncd accepts it |
| 25 Cadence preview classified anyway | F | F | |
| 26 Upgrade confirmation behind module | P | F | |
| 27 Downgrade provider-confirmed before storing | N | P | Beztack "confirmation" is a `getProduct` lookup |
| 28 preview + accept one Interface | P | F | |
| 29 Pricing catalog owns tier rank | N | P | Beztack uses `plan.displayOrder` as rank |
| 30 dedicated Beztack-owned Pending state | F | F | |
| 31 projection calls activation | P | F | lncd activates via the store directly; but lncd also updates the provider amount (A), Beztack does not |
| 32 projection calls reconciliation | P | F | |
| 33 routes transport-only | P | P | Beztack's `plan-change/*` routes are 400-660 lines of store wiring |
| 34-35 Current Subscription + authz inside module | F | F | |
| 36 narrow provider seam | N | F | lncd passes the full `PaymentProviderAdapter` |
| 37-38 test adapter, substitutable Pending store | P / F | F / F | |
| 39 no provider-metadata Pending | P | F | lncd projection still reads `pendingPlanChange*` metadata; engine 1 coexists |
| 40-41 Plan change vocabulary, old Upgrade routes removed | N | F | lncd keeps `preview-upgrade` and `PATCH /subscriptions/:id` |
| 42 domain-shaped errors | P | F | lncd: HTTP-status errors, no codes |
| 43-45 (agent stories) | -- | -- | not code |

### #15 Isolate Mercado Pago subscriptions by native Application

| # | lncd | Beztack main | Note |
|---|---|---|---|
| 1-3 plans/subscriptions per Application, hide same-email others | F | F | lncd adapter filters + scans pages for both |
| 4 same-Application Subscription visible without local row | F | F | |
| 5 org mode: payer email insufficient | N | F | lncd `subscription-ownership.ts` matches payer email before org identity |
| 6 user mode by payer email / user id | F | F | |
| 7 startup fails without Application ID | F | F | |
| 8-9 missing/mismatched identity hidden, cross-App = not found | F | F | |
| 10 same-App wrong owner = forbidden | F | F | |
| 11 minimal skip diagnostics | N | N | neither adapter logs skipped resources |
| 12 created resources verified | F | F | |
| 13 page scanning | F | F | |
| 14 other-App local plans need re-linking | F | F | `sync.ts` identical |
| 15-16 Membership cache validates cached subscription id | N | F | `canUseCachedMembership` is Beztack-only |
| 17-18 webhooks from other App skipped; payment events need verified subscription | F | F | |
| 19 adapter contract requires native boundary | P | P | both MP-only |
| 20-21 docs: App ID vs integrator ID, checklist | N | F | Beztack `apps/docs/content/docs/payments/mercado-pago.mdx` |
| 22 ADR | F | F | lncd ADR-0003 copy |

Takeaway for #44: #15 is effectively done in Beztack (lncd adds nothing); #17 is mostly done
in Beztack's module, and lncd contributes the pieces in section 2 -- above all provider-side
renewal activation, the shared Billing manager gate, Pending Plan change audit + read path +
UI, and `billingCadence`.

## Counts

**A 28, B 22, C 17** (67 entries; a row grouping several files counts once; a row is counted
by its leading class, so "B (+ A pieces)" counts as B and "A (one piece)" as A). Most A rows
are *pieces* of a file, not whole files: no lncd module should be copied wholesale, because
Beztack's `plan-change.ts`, Subscription projection, MP adapter and #15 isolation are ahead.

## Open questions

- Renewal activation retry: keep webhook-driven activation only (Beztack today) or add a
  claim/apply/retry worker like lncd engine 1's `applyDueSubscriptionChange`? Decide in #44.
- Cadence change for MP: Beztack refuses acceptance (#17 story 24) and yearly checkout; with
  `updateSubscription({ productId })` implemented as plan + frequency switch, MP could accept
  it. Not verified against the MP API (no sandbox call made here).
- Whether the Billing manager rank (`member < admin < owner`) belongs to #45's role model or to
  billing; lncd's `rider` rank shows the coupling.
- Not determined: whether lncd's activation amount update ever ran in production (no logs
  read), and whether Beztack's `confirmPendingPlanChange` (`getProduct` lookup) is meant as the
  final "provider confirmation" or a placeholder.
