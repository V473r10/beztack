# Research: lncd organization, role and auth code (#40)

Map: #37. Sources compared: Beztack `origin/main` @ `e3016d0`, lncd `main` @ `822c038`
(2026-09-29). March baseline = `.beztack/origin.json` (2026-03-28); for every "both sides" file
the baseline hash was located in Beztack history so each delta is attributed to lncd, Beztack or
both. Diffs taken with whitespace ignored; Biome/Vite+ formatting and `vitest` -> `vite-plus/test`
imports are toolchain and do not count. better-auth claims were checked against the installed
`better-auth@1.4.6` sources in Beztack's `node_modules` (lncd is on `^1.5.6`), not run.

Classes (map Notes): **A** lncd better and generic, **B** lncd-specific, **C** no substantive
difference.

## Per-file classification

### lncd-only files

| File | Class | Reason |
|---|---|---|
| `apps/api/server/domain/caller-identity/**` (`contract`, `index`, `implementation`, `production`, `testing`, `internal/lookups`, test) | B | Answers "who is reading this Order / Delivery" with kinds `account`/`rider`/`guest`/`catalog-bearer`/`id-bearer`; `CallerOrder` carries `origin`, `fulfillmentType`, `paymentMode`; lookups read `member` + `delivery`. Every rule is Order/Delivery domain and two kinds are marked TRANSITIONAL (ADR-0011). The **module shape** is the reusable part -- see the seam section. |
| `apps/api/server/utils/auth-roles.ts` | A (helper) / B (roles) | `getAuthRoles(role)` normalises better-auth's `role` (string, comma-separated string or array; empty -> `["user"]`) -- generic and needed: Beztack does ad-hoc `role?.includes("sudo")` substring checks (`require-auth.ts`, `ui/lib/admin-utils.ts` even does `r.includes("sudo")` on each element). `AuthRole = "admin" \| "user" \| "consumer"`, `isConsumerRole`, `isRestaurantRole` are lncd domain. Port `getAuthRoles`/`hasAuthRole` with a Beztack role union; overlaps `app-admin.ts#getRoleValues` (lncd has two parsers -- merge into one when porting). |
| `apps/api/server/utils/auth-sign-up-role.ts` (+ test) | B | Maps sign-up body `userType: "consumer"` -> `consumer`, else `user`. Consumer-vs-restaurant accounts are lncd domain. The mechanism (after-sign-up hook sets `user.role` from validated body) is a pattern, not code worth porting; note it trusts a client-supplied field, fine only because `consumer` grants nothing extra. |
| `apps/api/server/utils/app-admin.ts` | A | One owner for "App admin": `getAppAdminEmails()` (trim+lowercase), `hasAppAdminRole(role)` (`sudo` in parsed roles), `isAppAdminActor({email, role}, emails?)` = sudo **and** allowlisted. Beztack copy-pastes the `APP_ADMIN_EMAILS.split(",")...` block 3x (`auth.ts` x2, `require-auth.ts`) plus `utils/membership.ts`. lncd routes (`membership/status.get.ts`, `organization/billing-access.get.ts`, `subscriptions/[id]/pending-plan-change.delete.ts`) all call it and tests mock it. |
| `apps/api/server/utils/guest-session.ts` + `routes/api/orders/guest-session.post.ts` | B | QR-table guest session: reads `restaurantTable.qrToken`, `organization.orderingEnabled`, sets `beztack_guest_session` cookie (24h). Restaurant domain. Also reads `process.env.NODE_ENV` directly (env regression noted in #42). |
| `apps/api/server/utils/organization-business-type.ts` (+ test) | B | `restaurant \| supermarket` business type parsed from org `metadata`, stripped in `beforeCreateOrganization` and used to seed demo menu data. Domain. Generic residue (a JSON-or-object `parseMetadata` helper) is too small to port on its own. |

| Invitation acceptance flow: `apps/ui/src/app/public/accept-invitation/accept-invitation.tsx`, `components/accept-invitation-modal.tsx`, `components/invitation-auth.tsx`, `hooks/use-invitation-preview.ts`, API `routes/api/invitations/[id].get.ts` | A | Fills a real hole: Beztack's `sendInvitationEmail` already links to `${baseUrl}/accept-invitation/${id}`, but Beztack's UI has **no** `accept-invitation` route (only in-app `components/organizations/user-invitations.tsx`), so every invitation email lands on a 404. lncd: unauthenticated preview endpoint (org name/logo, inviter, role, status, expiry; 404 when missing), page handles invalid / non-pending / expired, email mismatch (sign out and continue), inline sign-in/sign-up tabs prefilled with the invited email, accept/reject modal that `setActive`s the org and invalidates org queries. Rework before port: all copy is hard-coded Spanish (move to `lib/i18n/locales`), drop the `ConsumerAccountMismatch` branch and `isConsumerSession` (B), two-factor redirect path `/auth/restaurant/sign-in/two-factor` -> Beztack's `/auth/sign-in/two-factor`, and trim the preview payload (it returns invitee and inviter email to anyone holding the id; the id is a bearer secret, but `organization.name` + role is enough). `me.get.ts` is formatting-only (C). |
| `apps/ui/src/components/admin-invitation-modal.tsx` | B | Despite the name it is not about org invitations: a scroll-triggered "go to admin" upsell on the public menu (`app/public/menu/public-menu.tsx`). Visibility logic is inverted (`dismissed === "true" \|\| isAdmin` shows it). Do not port. |
| `apps/ui/src/components/org-admin-route.tsx` | C | Route guard for active-org `owner`/`admin` via `useIsOrgAdmin`. Beztack already has the same guard as `OrgAdminRoute` inside `components/admin-route.tsx`; lncd's only extra is redirecting to `/auth/restaurant/sign-in` (B). Splitting it into its own file is cosmetic. |
| `apps/ui/src/hooks/use-org-settings.ts` | B | Org `currency` read/write (`?? "UYU"`, PUTs to `/api/organization/theme`). Tied to lncd's org settings/theme routes and the currency default problem from #42; revisit only with the project-level currency config. |
| `apps/ui/src/lib/auth-roles.ts` (+ test) | A (2 helpers) / B (rest) | Generic: `getAuthRoles`/`hasAuthRole` (same parser as the API copy -- share it, e.g. from a small package) and `getSafeRedirectTarget(next, fallback)` (rejects non-`/`, `//host` and `/auth*` targets -- an open-redirect guard Beztack's auth pages do not have; Beztack's sign-in has no `next` handling at all). B: `AuthAccountType = "restaurant" \| "consumer"`, `isConsumer*/isRestaurant*`, `matchesAuthAccountType`, `getDefaultAuthRedirect`, `getAuthPath` (`/auth/${accountType}/...`). |

### Files changed on both sides

| File | Class | Reason |
|---|---|---|
| `apps/api/server/utils/auth.ts` | A (wiring) / B (domain hooks) | Both sides changed since baseline `a645bb1`. **Beztack** replaced `hooks: { after }` with a top-level `after: [...]` array and added `isAppAdmin` injection + `sudo` promotion there. better-auth 1.4.6 only reads `options.hooks.before/after` (`dist/api-*.mjs`), and nothing reads `options.after` -- so in Beztack today the welcome email, the `sudo` promotion and the `isAppAdmin` flag **never run** (to verify at runtime). **lncd** kept `hooks` and is generic-better in: (1) `trustedOrigins` from `env.CORS_ORIGINS` instead of hardcoded `${projectName}.vercel.app`/`codedicated.com`/`app.beztack.com`; (2) `admin({ defaultRole: "user", adminRoles: ["sudo"], roles: { sudo: adminAc, user: userAc } })` -- Beztack writes `role = "sudo"` but its `admin()` uses defaults (`adminRoles: ["admin"]`, roles `{admin,user}`), so better-auth's `hasPermission` finds no AC for `sudo` and the admin endpoints Beztack's UI calls (`authClient.admin.listUsers`, `banUser`...) deny App admins; (3) `hooks.before` rejects every `/admin/*` better-auth endpoint unless `isAppAdminActor` (sudo **and** allowlist), so a stale `sudo` row is not enough; (4) `promoteAppAdminSession` on every auth activity via `app-admin.ts`; (5) invitation URL from `env.APP_URL` instead of `NODE_ENV ? vercel : localhost`. B parts: `consumer` admin role, org role `rider`, `businessType` additional field, `organizationHooks` seeding demo data, `getSignUpRole`. Drop/keep: lncd removed Beztack's empty `organizationDeletion` TODO stubs (fine) and changed cookie `secure` to `env.APP_URL.includes("https")` (sniffing a string; keep Beztack's `NODE_ENV` or use `new URL(APP_URL).protocol`). |
| `apps/api/server/utils/require-auth.ts` (+ lncd test) | A | Same baseline `fd6c473`; both renamed `isAdmin` -> `isAppAdmin` (sudo + allowlist). lncd delegates to `isAppAdminActor` and adds `require-auth.test.ts` (org `admin` + allowlisted email -> 403, stale `sudo` off-list -> 403, sudo + allowlist -> ok) -- port the test with it. lncd **deleted** `requireAuth` and `requireOwnerOrAdmin`; Beztack still uses `requireAuth` (`routes/api/auth/admin/metrics.ts`), so keep both exports in Beztack. Beztack also substring-matches `role?.includes("sudo")` on a string (matches `"pseudo"`); lncd's parsed-role check fixes that. |
| `apps/ui/src/hooks/use-organizations.ts` | C | Beztack base `d1de233`. lncd: literal keys -> `queryKeys.organizations.*` (pattern already classified A under `query-keys.ts` in #42) and `businessType` on create (B). Beztack is ahead: `invalidateOrganizationContext` also invalidates `["subscriptions"]` on create/update/delete/setActive -- keep Beztack's and add it to the query-keys migration. |
| `apps/ui/src/components/admin-route.tsx` | C | Base `a645bb1`; both converged on an App-admin (`sudo`) guard and dropped the `console.log`. Beztack additionally exports `OrgAdminRoute` here (lncd moved it to its own file). Nothing to port. |
| `apps/ui/src/lib/admin-utils.ts` | A (small) | Base `bc2a3c7`; both split "App admin" from "org admin" but differently. Beztack: `useIsAdmin` = sudo **or** active-org owner/admin (fetches `useOrganizationMembers` -- an extra request) and `useIsAppAdmin` = sudo. lncd: `useIsSudo` = sudo, `useIsOrgAdmin` = owner/admin read from `activeOrg.members` (no extra query, sudo **not** a superset), `getUserRoleLabelKey` (i18n key per app role). Port lncd's names/shape (`useIsSudo`/`useIsAppAdmin` + `useIsOrgAdmin`), drop lncd's misleading `useIsAdmin = useIsSudo` alias; whether sudo implies org admin is a decision to make explicitly (see Role model). Both still do substring `role.includes("sudo")` client-side -- replace with the shared `getAuthRoles`. |
| `apps/ui/src/components/app-sidebar.tsx` (+ lncd `app-sidebar.test.tsx`) | A (pattern) / B (items) | Base `1cb3e7f`. Beztack: separate `navAdmin` ("Organization", org admins) and `navSudo` ("Platform", App admins). lncd: one `navAdmin` for App admins plus role-filtered items via `ADMIN_ONLY_NAV_URLS` / `BILLING_MANAGER_ONLY_NAV_URLS` sets driven by `useIsOrgAdmin` and `useIsBillingManager`, with a render test (`renderToStaticMarkup`, mocked role hooks) asserting what each role sees. Port the filter-by-capability pattern and the test; keep Beztack's sections. B: menu/orders/tables/riders items, `/dashboard`, "La Nueva Carta Digital". `useIsBillingManager` belongs to subscriptions (ADR-0007, see Role model). |
| `apps/ui/src/app.tsx` | A (guard wiring) / B (routes) | Base `4b4e9df`; Beztack only split `/admin` into its own `AdminRoute` + `MainLayout` tree and added `AdminTierOverrideBanner` (lncd has the banner too). lncd's generic delta is **where guards are applied**: `/organizations` wrapped in `OrgAdminRoute`, `/billing` in `BillingManagerRoute`, and `ProtectedRoute` gained `allowedRoles` / `signInPath` / `unauthorizedPath` (`components/protected-route.tsx`, outside this ticket's list but required by it). In Beztack `OrgAdminRoute` is exported from `admin-route.tsx` and **used nowhere**, and `/billing` has no UI gate. Port the `ProtectedRoute` props and the wrapping; decide separately whether plain members lose `/organizations` (it also hosts `UserInvitations`, so with the accept-invitation page ported that is fine). B: ~60 menu/orders/rider/account/storefront routes, `/auth/{restaurant,consumer}/*`, `RiderRoute`/`RiderShell`. |
| `apps/ui/src/contexts/membership-context.tsx` | C (for this ticket) | Base `1c6e554`; both sides grew it (Beztack 544 -> 728 lines in `551a596`, `b718450`, `7e8dda7`; lncd -> 884). The auth-relevant parts already converged: org-scoped subscriptions via `VITE_SUBSCRIPTION_MODE === "organization"` + `activeOrganizationId`, and `isAppAdmin` read from the server's `/api/membership/status` instead of sniffing the client role. The remaining delta is plan-change / pending-plan-change / admin-tier-override response shapes, owned by the subscriptions research (ADR 0001/0002/0004), not here. |

Counts: **A 9, B 6, C 4** (19 entries). "A (x) / B (y)" rows count as A: port the named generic
part only. `caller-identity/**` and the invitation flow are one entry each.

Adjacent, outside the ticket's file list but needed to port the A items:
`apps/ui/src/components/protected-route.tsx` (`allowedRoles` props), `billing-manager-route.tsx` +
`hooks/use-billing-access.ts` + `routes/api/organization/billing-access.get.ts` (billing gate,
travels with subscriptions), and `requireActiveOrganization` / `requireStaffMember` /
`requireOrgAdmin` in `apps/api/server/utils/menu.ts` (generic org-role API guards living in a
domain file; Beztack has no org-role API guard at all -- routes read `member.role` ad hoc).

## Role model

lncd ended up with **two independent axes plus non-user principals**, and ADR-0007
(`docs/adr/0007-organization-role-tier-access-control.md` in lncd) is the written decision.

**1. App-level role (`user.role`, better-auth `admin` plugin)**

| Role | Meaning | Generic? |
|---|---|---|
| `sudo` | App admin (platform operator). Effective only with the email in `APP_ADMIN_EMAILS` (`isAppAdminActor`); allowlisted users are auto-promoted on auth activity; better-auth `/admin/*` endpoints are gated by a `hooks.before` on the same check. `adminRoles: ["sudo"]`, `sudo: adminAc`. | Generic. Beztack already uses the name but its `admin()` config does not register it (see `auth.ts` row). |
| `user` | Default role (`defaultRole: "user"`). In lncd it means "restaurant account". | Generic as "default account". |
| `consumer` | End-customer account, chosen at sign-up via `userType`, kept out of the staff app (`ProtectedRoute allowedRoles`), routed to `/account`. | **lncd-domain** (storefront customer vs business account). |

**2. Organization role (`member.role`, better-auth `organization` plugin), scoped to the active org**

| Role | Access (ADR-0007) | Generic? |
|---|---|---|
| `owner`, `admin` | Full: org settings, members, billing, plus all domain CRUD. API guard `requireOrgAdmin`; UI `useIsOrgAdmin` / `OrgAdminRoute`. | Generic (better-auth `defaultRoles`). |
| `member` | "Staff": domain CRUD but not org settings / billing / member management. API guard `requireStaffMember` (= not `rider`). | Generic. |
| `rider` | `memberAc` org role restricted to the `/rider` PWA; may read an Order/Delivery only when assigned. | **lncd-domain** (delivery). |

Plus one configurable capability on the org: **billing manager** = role >= `organization.billingManagedByRole`
(default `owner`; ADR-0007 "Billing exception"), with App admins always passing. Beztack already has the
column and uses it in `subscriptions/plan-change/accept.post.ts`; lncd adds the
`/api/organization/billing-access` read and the UI gate (`useIsBillingManager`, `BillingManagerRoute`,
sidebar filter). Generic, but owned by the subscriptions research.

**3. Non-user principals (all lncd-domain)**: Guest Session (QR table cookie), and the two
TRANSITIONAL bearer kinds `catalog-bearer` / `id-bearer` in `caller-identity` (ADR-0011 replaces them
with an Order access token). `businessType` (`restaurant` / `supermarket`) is an org attribute that
seeds demo data, not a role -- also domain.

**Decisions worth carrying into Beztack**
- Keep the two axes separate: App role never grants org access, org role never grants platform access.
  ADR-0007 explicitly rejects a sudo bypass on org guards ("adding a bypass later is additive,
  removing one is hard"). Beztack's UI currently goes the other way (`useIsAdmin` = sudo **or**
  org owner/admin); pick one deliberately -- lncd's is the safer default for a public product.
- Access follows the **active-org** membership (a user can be `admin` in one org and `member` in
  another).
- Named API guards (`requireActiveOrganization`, `requireOrgAdmin`, `requireStaffMember`) instead of
  `allowRoles` arrays at call sites. Beztack has none of these; extract them from lncd's `menu.ts`
  into e.g. `utils/organization-access.ts`, renaming `requireStaffMember` to whatever "any non-restricted
  member" means once Beztack has a restricted role (with only `owner/admin/member` it is just
  `requireActiveOrganization`).
- One role parser (`getAuthRoles`) shared by API and UI; no substring `includes("sudo")`.
- Beztack generic target model: App roles `sudo` + `user`; org roles `owner` / `admin` / `member`;
  billing manager capability. Projects add their own (`consumer`, `rider`...) by extending the role
  maps, which is exactly how lncd added them.

## The `domain/<name>/{contract,implementation,production,testing}` seam

**Verdict: adopt as a documented, opt-in convention -- not as a default for every module.**

What it is (lncd `AGENTS.md` "Module Shape"; reference implementations `domain/address-resolution/`
and `domain/caller-identity/`): `contract.ts` (types + interface + errors), `index.ts` (re-exports the
contract and the one production instance; callers import the directory), `implementation.ts` (a
factory taking one dependencies object whose fields are all optional and **fail closed** by
default), `internal/` (nothing outside may import it), and adapters at that one seam:
`production.ts` (real `db`, session, cookie), `testing.ts` (hand-written in-memory world),
`test-database.ts` only where real SQL semantics matter (PGlite).

Why it earns its place in Beztack:
- `caller-identity` shows the payoff: 141 lines of tests cover every 401/403/kind branch through
  `createCallerIdentityTestModule({ userId, memberships, ... })` -- no database, no cookies, no
  `vi.mock` of module paths. Beztack's equivalents mock module paths (`vi.mock("@/server/utils/...")`)
  and its auth decisions are scattered (`require-auth.ts`, `utils/membership.ts`,
  `utils/subscription-ownership.ts`, ad-hoc `member.role` reads in plan-change routes).
- The contract doc-comments carry the decision record next to the code (status semantics, which
  resource admits which caller, what is TRANSITIONAL and which issue deletes it).
- It is already half-present in Beztack's vocabulary: ADR 0001 is literally a "subscription
  projection seam".

Why not by default (lncd's own guard rail, worth copying verbatim): two adapters make a real seam;
one makes a hypothetical one. A single function with one optional dependency (lncd's
`lifecycle-transition.ts`) is the more common right answer. Beztack-specific cautions:
- `index.ts` exporting the production instance means importing the directory pulls `@beztack/db`;
  tests must import `./testing` / `./implementation` directly (lncd does).
- The "nothing imports `internal/`" rule is convention only; nothing enforces it. If adopted, add a
  lint rule (Vite+/oxlint `no-restricted-imports` pattern) when the toolchain ticket lands.
- `domain/` is an API-only folder in lncd; Beztack would need to say whether packages
  (`packages/payments/*`) follow the same shape or keep their package boundary as the seam.

Concrete first candidate in Beztack: an **organization/access** module that owns "may this caller act
on this Organization / Subscription" -- consolidating `isAppAdminActor`, the org-role guards from lncd
`menu.ts`, the billing-manager check and `subscription-ownership.ts` -- with `production` (db +
better-auth session) and `testing` (in-memory memberships) adapters. That has two real adapters from
day one. `caller-identity` itself is **not** portable (Order/Delivery domain); its shape is.

Porting the convention means: copy the "Module Shape" section into Beztack `AGENTS.md` (already
flagged A in #42), minus lncd ADR numbers, keeping the "When not to reach for it" paragraph.

## Open questions / not determined

- Beztack's top-level `after: [...]` in `auth.ts` being ignored and `sudo` lacking an admin-plugin AC
  entry were established by reading better-auth 1.4.6 sources (`options.hooks.*` only;
  `hasPermission` over `options.roles || defaultRoles`), not by running Beztack. Confirm with a sign-up
  (welcome email sent?) and an `authClient.admin.listUsers` call as an allowlisted user before
  prioritising the fix.
- lncd is on better-auth `^1.5.6`; whether `hooks.before` on `/admin/*` and `adminAc`/`userAc`
  imports behave identically on 1.4.6 was not checked. Port together with the better-auth bump if
  needed.
- Whether App admins should implicitly be org admins in Beztack (lncd: no; Beztack UI: yes) is a
  product decision for the grilling, not a research finding.
