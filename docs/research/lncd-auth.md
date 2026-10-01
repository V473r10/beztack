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

### Files changed on both sides

| File | Class | Reason |
|---|---|---|
| `apps/api/server/utils/auth.ts` | A (wiring) / B (domain hooks) | Both sides changed since baseline `a645bb1`. **Beztack** replaced `hooks: { after }` with a top-level `after: [...]` array and added `isAppAdmin` injection + `sudo` promotion there. better-auth 1.4.6 only reads `options.hooks.before/after` (`dist/api-*.mjs`), and nothing reads `options.after` -- so in Beztack today the welcome email, the `sudo` promotion and the `isAppAdmin` flag **never run** (to verify at runtime). **lncd** kept `hooks` and is generic-better in: (1) `trustedOrigins` from `env.CORS_ORIGINS` instead of hardcoded `${projectName}.vercel.app`/`codedicated.com`/`app.beztack.com`; (2) `admin({ defaultRole: "user", adminRoles: ["sudo"], roles: { sudo: adminAc, user: userAc } })` -- Beztack writes `role = "sudo"` but its `admin()` uses defaults (`adminRoles: ["admin"]`, roles `{admin,user}`), so better-auth's `hasPermission` finds no AC for `sudo` and the admin endpoints Beztack's UI calls (`authClient.admin.listUsers`, `banUser`...) deny App admins; (3) `hooks.before` rejects every `/admin/*` better-auth endpoint unless `isAppAdminActor` (sudo **and** allowlist), so a stale `sudo` row is not enough; (4) `promoteAppAdminSession` on every auth activity via `app-admin.ts`; (5) invitation URL from `env.APP_URL` instead of `NODE_ENV ? vercel : localhost`. B parts: `consumer` admin role, org role `rider`, `businessType` additional field, `organizationHooks` seeding demo data, `getSignUpRole`. Drop/keep: lncd removed Beztack's empty `organizationDeletion` TODO stubs (fine) and changed cookie `secure` to `env.APP_URL.includes("https")` (sniffing a string; keep Beztack's `NODE_ENV` or use `new URL(APP_URL).protocol`). |
| `apps/api/server/utils/require-auth.ts` (+ lncd test) | A | Same baseline `fd6c473`; both renamed `isAdmin` -> `isAppAdmin` (sudo + allowlist). lncd delegates to `isAppAdminActor` and adds `require-auth.test.ts` (org `admin` + allowlisted email -> 403, stale `sudo` off-list -> 403, sudo + allowlist -> ok) -- port the test with it. lncd **deleted** `requireAuth` and `requireOwnerOrAdmin`; Beztack still uses `requireAuth` (`routes/api/auth/admin/metrics.ts`), so keep both exports in Beztack. Beztack also substring-matches `role?.includes("sudo")` on a string (matches `"pseudo"`); lncd's parsed-role check fixes that. |

## Role model

TBD

## The `domain/<name>/{contract,implementation,production,testing}` seam

TBD
