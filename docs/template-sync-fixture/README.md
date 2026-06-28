# Template sync engine contract fixture

A minimal reproducible fixture for the Beztack **Template sync engine
contract**. It exists to drive fair comparisons between candidate engines
(Copier, Cruft/Cookiecutter, Git subtree, Copybara, custom) and to anchor
later implementation work. It encodes the domain contract from PRD #27 and
ADRs 0005 and 0006, not the implementation choices of any specific engine
or the WIP CLI prototype.

## Scope

In scope:

- A Template source represented as two revisions (`v1.1.0` and `v1.2.0`).
- A single Derived project state with a Schema-versioned Sync policy,
  Origin baseline, Template parameters, and Sync state.
- Schemas for Sync policy, Origin baseline, Sync state, Apply plan, and
  Promotion metadata.
- Expected observable outputs for `status`, `apply`, and Promotion
  metadata.

Out of scope:

- A runnable engine implementation. Engines under test must read this
  fixture and produce equivalent outputs.
- The real Beztack → lncd validation case (separate issue #28 deliverable).
- Any tool-specific configuration files (Copier/Cruft/subtree metadata).

## Layout

```text
docs/template-sync-fixture/
├── README.md                          # this file
├── schemas/                           # JSON Schemas for engine I/O
│   ├── sync-policy.schema.json
│   ├── origin-baseline.schema.json
│   ├── sync-state.schema.json
│   ├── apply-plan.schema.json
│   └── promotion-metadata.schema.json
├── template-revisions/                # Template source snapshot per revision
│   ├── v1.1.0/                        # last accepted (Origin baseline)
│   │   ├── packages/auth/session.ts
│   │   ├── apps/api/routes.ts
│   │   ├── .env.contract.json
│   │   └── package.json
│   └── v1.2.0/                        # candidate
│       ├── packages/auth/session.ts
│       ├── apps/api/routes.ts
│       ├── apps/api/middleware.ts     # NEW
│       ├── .env.contract.json
│       └── package.json
├── derived-project/                   # Derived project state
│   ├── .beztack/
│   │   ├── template.json              # Sync policy
│   │   ├── parameters.json            # Template parameters
│   │   ├── origin.json                # Origin baseline (v1.1.0)
│   │   ├── sync-state.json            # current Sync state
│   │   └── promotion-label.md         # Promotion label convention
│   ├── packages/auth/session.ts
│   ├── apps/api/routes.ts             # mixed ownership, seam content
│   ├── apps/api/middleware.ts         # mixed, no seam — conflict case
│   ├── apps/checkout/                 # Custom-owned Product domain
│   │   ├── index.ts
│   │   ├── payment-handler.ts
│   │   └── README.md
│   ├── packages/util/                 # Promotion PR (template-owned path)
│   │   ├── retry.ts
│   │   └── package.json
│   ├── .env.contract.json             # Template-owned Environment contract
│   ├── .env.example                   # Custom-owned product example
│   ├── package.json                   # Template-owned, parameters rendered
│   └── pnpm-lock.yaml                 # Custom-owned; regenerated locally
├── expected/                          # Golden outputs engines must match
│   ├── status.json
│   ├── apply-plan.json
│   └── promotion-metadata.json
└── tests/                             # Self-check (node:test)
    └── fixture.test.mjs
```

## Acceptance criteria mapping (issue #29)

Each issue #29 acceptance criterion maps to a specific case in the fixture.

| Acceptance criterion                                | Fixture case                                                                  |
|-----------------------------------------------------|-------------------------------------------------------------------------------|
| Template-owned, Custom-owned, Mixed ownership       | `packages/auth/**` (template-owned vs custom-owned overlap), `apps/checkout/**` (custom-owned), `apps/api/routes.ts` (mixed via seam) |
| Product domain change preserved                     | `apps/checkout/index.ts`, `apps/checkout/payment-handler.ts`, `apps/checkout/README.md` (Custom-owned, skipped during apply) |
| Template parameter case                             | `package.json` (`{{appName}}` rendered to `derived-app` in Derived project, re-rendered on apply) |
| Environment contract distinct from product examples | `.env.contract.json` (Template-owned, synced), `.env.example` (Custom-owned, never synced) |
| Sync conflict reported, not silently merged         | `apps/api/middleware.ts` (Mixed, no seam, both Template v1.2.0 and Derived project have content) → `expected/apply-plan.json#conflicts` |
| Ownership overlap or shadowing warns/fails before apply | `packages/auth/session.ts` matched by `packages/**` (template-owned) and `packages/auth/**` (custom-owned) → `expected/status.json#overlaps`, `expected/apply-plan.json#skipped` |
| Promotion eligibility excludes Custom-owned and reports skipped | `packages/util/retry.ts` and `packages/util/package.json` → candidates; `apps/checkout/**` → skipped (custom-owned-product-domain) in `expected/promotion-metadata.json` |
| Documents expected status, apply, Promotion metadata | `expected/status.json`, `expected/apply-plan.json`, `expected/promotion-metadata.json` |

## Additional coverage from PRD #27

| PRD #27 testing decision                            | Fixture case                                                                  |
|-----------------------------------------------------|-------------------------------------------------------------------------------|
| Template parameter case                             | `package.json` (`{{appName}}` placeholder rendering)                          |
| Environment contract case                           | `.env.contract.json` (Template-owned) vs `.env.example` (Custom-owned)        |
| Lockfile regeneration case                          | `pnpm-lock.yaml` (Custom-owned; engines regenerate locally after apply)       |
| Sync conflict case                                  | `apps/api/middleware.ts` (Mixed, no seam, both sides changed)                 |
| Promotion eligibility case                          | `packages/util/retry.ts`, `packages/util/package.json` → candidates           |

## Expected observable behavior

### `status`

The engine must emit a JSON object that conforms to `schemas/sync-state.schema.json` and matches `expected/status.json` semantically (engines may add fields; required fields and enum values must match). For this fixture the canonical status is:

- `status: "conflicts"` because `apps/api/middleware.ts` is a real conflict.
- `overlaps` contains both `packages/auth/session.ts` and `apps/checkout/payment-handler.ts` with `severity: "warning"`.
- `recommendation.action: "review-conflicts"`.
- Per-file ownership and drift classifications match the table below.

| Path                            | Ownership       | Drift              | Notes                          |
|---------------------------------|-----------------|--------------------|--------------------------------|
| `packages/auth/session.ts`      | custom-owned    | template-changed   | Overlap (warning).             |
| `apps/api/routes.ts`            | mixed           | project-changed    | Seam `api-route-registration`. |
| `apps/api/middleware.ts`        | mixed           | both-changed       | Conflict (no seam).            |
| `apps/checkout/index.ts`        | custom-owned    | added              | Product domain.                |
| `apps/checkout/payment-handler.ts` | custom-owned | added              | Product domain; overlap.       |
| `apps/checkout/README.md`       | custom-owned    | added              | Product domain.                |
| `packages/util/retry.ts`        | template-owned  | added              | Promotion PR.                  |
| `packages/util/package.json`    | template-owned  | added              | Promotion PR.                  |
| `.env.contract.json`            | template-owned  | template-changed   | Environment contract.          |
| `.env.example`                  | custom-owned    | added              | Product example.               |
| `package.json`                  | template-owned  | both-changed       | Parameter rendering + deps.    |
| `pnpm-lock.yaml`                | custom-owned    | added              | Regenerated locally.           |

### `apply` (plan)

The engine must produce a plan conforming to `schemas/apply-plan.schema.json`
and matching `expected/apply-plan.json`. Key invariants:

- The plan names a branch (`template-sync/v1.1.0-to-v1.2.0`) — apply never
  mutates the main branch directly (ADR 0006, PRD #27 acceptance criteria).
- `updates` lists three files: `.env.contract.json`, `package.json`, and
  `apps/api/routes.ts` (with seam preservation).
- `skipped` lists Custom-owned files and template-owned additions that the
  candidate revision does not change, including `pnpm-lock.yaml`.
- `conflicts` lists `apps/api/middleware.ts` with reason
  `both-changed-no-seam`. The engine MUST NOT silently merge this file.
- `blockers` is empty: overlaps are warnings, not blocks.
- The summary explains the Environment contract update, Template parameter
  rendering, the seam-preserved harness update, the lockfile regeneration
  expectation, and the one conflict.

### Lockfile regeneration

Per ADR-0006 and `CONTEXT.md`, lockfiles are regenerated in Derived
projects rather than copied as Template-owned content. The Template
source revisions in this fixture deliberately do NOT include
`pnpm-lock.yaml`. The Derived project's `pnpm-lock.yaml` is classified
as Custom-owned in the Sync policy with an explicit note that engines
must regenerate it locally after the apply branch is prepared.

### Promotion metadata

The engine must produce metadata conforming to
`schemas/promotion-metadata.schema.json` and matching
`expected/promotion-metadata.json`. Key invariants:

- `trustClass: "trusted"` because the Derived project ID is on the
  Trusted Derived project registry.
- `label: "promotion: candidate"` (the documented Promotion label).
- `candidates` lists only files on Template-owned paths:
  `packages/util/retry.ts`, `packages/util/package.json`.
- `skipped` lists Custom-owned Product-domain files
  (`apps/checkout/index.ts`, `apps/checkout/payment-handler.ts`,
  `apps/checkout/README.md`) with reason `custom-owned-product-domain`.
- `checks` records the schema and ownership validation checks the engine
  ran.
- `suggestedTemplateVersionImpact: "minor"` because the candidates add a
  reusable Template-owned capability (PRD #27 minor semantics).

## How an engine uses this fixture

A conforming engine implementation, given this fixture, must:

1. Read `derived-project/.beztack/template.json` as the Sync policy.
2. Read `derived-project/.beztack/parameters.json` as Template parameters.
3. Read `derived-project/.beztack/origin.json` as the Origin baseline.
4. Read both `template-revisions/v1.1.0/` and `template-revisions/v1.2.0/`
   as the Template source revisions.
5. Treat `derived-project/` as the working tree.
6. Emit `expected/status.json` (or an equivalent) for `status`.
7. Emit `expected/apply-plan.json` (or an equivalent) for `apply --plan`.
8. Emit `expected/promotion-metadata.json` (or an equivalent) for a PR
   labelled `promotion: candidate`.
9. Regenerate `pnpm-lock.yaml` in the Derived project locally; never copy
   a lockfile from the Template source.

Engines under test must NOT add tool-specific metadata to the working
tree (no `.copier-answers.yml`, `.cruft.json`, etc.) as part of running
this fixture; the fixture's `derived-project/` state is what it is.

## Self-check

`tests/fixture.test.mjs` validates that the fixture itself is internally
consistent. It checks:

- All JSON files parse and conform to their declared schemas.
- The Origin baseline `templateHash` matches the v1.1.0 Template source
  files (which are immutable).
- The Sync state's classifications are internally consistent with the
  Sync policy's ownership rules.
- The expected outputs reference paths that exist in the Derived
  project or in the candidate Template revision.
- The README references every schema and expected output file.
- Every issue #29 acceptance criterion is covered by at least one
  fixture case.

Run with Node's built-in test runner (no external dependencies):

```bash
node --test docs/template-sync-fixture/tests/fixture.test.mjs
```
