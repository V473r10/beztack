# Mobile layout audit

Playwright drives the built UI at 360 and 393 px, in English and Spanish, and fails when a key page has a layout problem (BZ-117, spec BZ-105 V6). The API is mocked inside the browser (`mock-api.ts`, data in `fixtures.ts`), so the run needs no database, payment provider or API server.

Audited pages: sign-in, sign-up, home, pricing, billing, organizations, admin, admin/users, admin/plans, admin/plan-changes. Sign-in and sign-up are audited as a visitor; the rest as a signed-in App admin.

Each page fails the run when it has:

- **horizontal-scroll**: the page itself scrolls sideways.
- **past-viewport**: a visible interactive element sticks out of the viewport and no scrollable container of its own can bring it into view.
- **wrapped-button**: a button label breaks onto a second line (accordion triggers are exempt).
- **raw-i18n-key**: visible text or a label attribute shows an untranslated key such as `billing.page.title`.

The run also fails when the page makes an `/api/*` request that has no fixture, when a guard redirects away from the audited route, or when a dialog covers the page. Add the missing endpoint to `buildRoutes` in `mock-api.ts`. `layout-audit.e2e.ts` checks that the audit itself can fail.

## Run it

```sh
cd apps/ui
pnpm exec playwright install chromium        # once, or use a system Chromium (below)
pnpm test:e2e                                # both viewports
pnpm test:e2e --project=mobile-393 -g "(es) pricing"
```

To reuse a Chromium already on the machine, set `E2E_CHROMIUM_PATH=/usr/bin/chromium`. The port defaults to 5184 (`E2E_PORT`). The config builds the UI into `dist-e2e` and serves it with `vite preview`, because `vite dev` reloads the page mid-test when it re-optimizes dependencies.

On failure, a viewport screenshot per failing test lands in `test-results/` (uploaded as a CI artifact). Screenshots are never full-page.
