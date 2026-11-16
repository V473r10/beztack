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

# Live smoke test

A separate check that loads the deployed sites in a real browser (BZ-134, spec BZ-131). Unlike the layout audit, nothing is mocked and nothing is built: it points at URLs you give it. It is not part of `pnpm test:e2e` and CI does not run it. It only loads pages: it never signs in and never submits a form.

A 200 is not enough evidence: the UI is a single-page app that answers 200 on every path. So each check waits for content that only appears when the site works:

- **Marketing home** (`LIVE_WEB_URL`): the page's `<h1>` mentions "B2B SaaS". If the headline copy changes, update the check in `live-smoke.live.ts`.
- **App login page** (`LIVE_APP_URL`, path `/auth/sign-in`): a form with an email field, a password field and a submit button is visible. The check finds the fields by type, so it does not depend on the language.

The run exits non-zero when either check fails, or when a variable is unset or not a URL. The failure message names the URL and what did not render. Both URLs are required, with no defaults, so the run never targets production by accident.

```sh
cd apps/ui
LIVE_WEB_URL=https://www.beztack.com LIVE_APP_URL=https://app.beztack.com pnpm test:live
```

Use `E2E_CHROMIUM_PATH=/usr/bin/chromium` to reuse a system Chromium, as for the layout audit. Against production the run takes about 5 seconds. A failing check waits up to 15 seconds for its content and is retried once, so the worst case is still under a minute. On failure, a viewport screenshot lands in `test-results/live/`.
