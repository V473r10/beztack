# Template sync engine contract fixture

A minimal reproducible fixture for the Beztack **Template sync engine
contract**. It exists to drive fair comparisons between candidate engines
(Copier, Cruft/Cookiecutter, Git subtree, Copybara, custom) and to anchor
later implementation work. It encodes the domain contract from PRD #27 and
ADRs 0005 and 0006, not the implementation choices of any specific engine
or the WIP CLI prototype.

## Scope

In scope:

- A Template source represented as two revisions (`v1.1.0` and `v1.2.0`),
  each with a Schema-versioned Template manifest declaring the compatible
  Sync engine version range.
- A single Derived project state with Schema-versioned Sync policy, Origin
  baseline, Template parameters, Sync state, and Sync event log.
- Schemas for Sync policy, Origin baseline, Sync state, Apply plan,
  Promotion metadata, Sync event log, and Template manifest.
- Expected observable outputs for `status`, `apply`, and Promotion
  metadata.
- A schema-validation gate contract: engines must refuse unsupported
  schema versions before planning or applying a Template update.

Out of scope:

- A runnable engine implementation. Engines under test must read this
  fixture and produce equivalent outputs.
- The real Beztack → lncd validation case (separate issue #28 deliverable).
- Any tool-specific configuration files (Copier/Cruft/subtree metadata).

## Trusted Derived project registry (issue #32)

Trust is granted by Beztack through a Beztack-owned registry file, not
self-declared by Derived projects (ADR-0006). The registry lives
**outside the Derived project tree** in
`beztack/derived-project-registry.json`, ships under
`docs/template-sync-fixture/beztack/`, and is schema-versioned by
`derived-project-registry.schema.json`.

| Property                                | Value                                                                                       |
|-----------------------------------------|---------------------------------------------------------------------------------------------|
| Source of trust                         | Beztack-owned registry. Derived projects cannot self-declare trust.                        |
| Key                                     | Opaque stable `derivedProjectId`. Renames and remote URL changes do NOT change the ID.      |
| Trust classes                           | `trusted` (registry grant), `community` (default when absent or revoked).                   |
| Repository identity                     | `canonicalUrl` (current) + `knownUrls` (rename history). First entry is the canonical URL. |
| Revocation                              | `revokedAt` timestamp; engine treats revoked entries as community trust but keeps them.    |
| Where the registry lives                | `beztack/derived-project-registry.json` (NOT in any Derived project tree).                  |
| Schema                                  | `derived-project-registry.schema.json`. Pins `schemaVersion: "1.0"`.                       |
| Surface in engine outputs               | `sync-state.trust`, `apply-plan.trust`, `promotion-metadata.trust` (all schema-versioned). |

### Identity and rename traceability

A Derived project ID is generated once at scaffolding and is opaque. It
is **not** derived from the repository name, package name, or remote
URL, so renaming a repository (for example `V473r10/lncd` →
`beztack/lncd`) or moving it to a different host does NOT change the
ID. The Origin baseline, Sync state, Sync event log, and Promotion
metadata keep the same `derivedProjectId` across renames.

To preserve audit history across renames, the registry entry for a
Trusted Derived project records both the current `canonicalUrl` and the
full rename history in `knownUrls` (with the canonical URL as the first
entry). Beztack-owned tooling targets the canonical URL for automated
update notifications; the rename history is for traceability and review.

### Self-declared trust is refused

A `--trust-class trusted` flag (or any other project-side signal) is
honored only when the registry lists the `derivedProjectId` as
`trusted`. If the ID is absent from the registry, or the entry is
revoked, the engine exits with code 5 and refuses to plan or apply.
A Community maintainer can pass `--trust-class community` to opt out
of trusted dispatch for a single run, but cannot escalate to trusted.

### Community fallback

A Derived project whose ID is absent from the registry is treated as
`trustClass: "community"` with `source:
"registry-absent-default-community"`. The engine still runs, the
Sync state schema still validates, and the recommendation surfaces the
release-notes / local-tooling path so the maintainer does not need
Beztack-held permissions.

## Schema-versioned artifacts (issue #30)

Every file the engine reads from or writes to a Derived project is
schema-versioned. The schema version is a `const` on each schema, so the
JSON Schema validator refuses any value other than the supported version.
Engines must validate every input file before planning or applying a
Template update; engines that receive an unsupported version must abort
with a clear error and never produce a plan.

| Artifact                 | Schema                          | Where it lives                                                | Purpose                                                                  |
|--------------------------|---------------------------------|---------------------------------------------------------------|--------------------------------------------------------------------------|
| Sync policy              | `sync-policy.schema.json`       | `<derived>/.beztack/template.json`                            | Declares Ownership rules, Sync seams, Environment contract, parameters.  |
| Origin baseline          | `origin-baseline.schema.json`   | `<derived>/.beztack/origin.json`                              | The Template revision the Derived project last accepted, plus per-file metadata for drift detection. |
| Sync state               | `sync-state.schema.json`        | `<derived>/.beztack/sync-state.json`                          | Current machine-readable sync status. Not an audit log.                  |
| Sync event log           | `sync-event-log.schema.json`    | `<derived>/.beztack/sync-event-log.json`                      | Append-only audit trail of sync actions and Promotions.                  |
| Apply plan               | `apply-plan.schema.json`        | Engine output                                                  | Plan the engine prepares for a reviewable branch.                        |
| Promotion metadata       | `promotion-metadata.schema.json` | Engine output                                                 | Metadata for an opt-in Promotion from a Derived project PR.              |
| Template manifest        | `template-manifest.schema.json` | `<template-revisions>/<version>/template.json`                | Declares Template identity, semver, expected sync impact, the compatible Sync engine version range, and Template migrations declared at this version. |
| Trusted Derived project registry | `derived-project-registry.schema.json` | `<fixture>/beztack/derived-project-registry.json` (Beztack-owned) | Maps opaque Derived project IDs to a trust class and the expected repository identity (canonical URL + rename history). The single source of truth for trust. |

### Sync engine version vs. Template version

The Sync engine version is recorded in three places (per ADR-0006):

- `sync-state.json#syncEngine` — engine that produced the current state.
- `apply-plan.json#syncEngine` — engine that produced the plan.
- Each `sync-event-log.json#events[].syncEngine` — engine that recorded
  the event.

The Template version is recorded separately in:

- `origin.json#templateRevision` — last accepted Template revision.
- `apply-plan.json#fromRevision` and `toRevision` — the move being planned.
- `sync-event-log.json#events[].details.fromRevision` /
  `toRevision` — the move recorded in the event.
- `template-manifest.json#version` and `semver` — the published Template
  version's identity.

Engines must keep the two versions distinct. A Template version bump must
never change the Sync engine version requirement implicitly; the change
must be declared explicitly via `compatibleEngines`.

### Origin baseline ordering

The Origin baseline is built around the Template revision first. The
required fields appear in this order: `templateRevision`,
`templateRevisionRef`, `acceptedAt`, then the per-file metadata. The
per-file metadata is supporting drift evidence for offline work and
reconciliation — it is not the source of truth for sync decisions.

### Sync state vs. Sync event log

Sync state and Sync event log are two distinct artifacts (per CONTEXT.md
and PRD #27):

- **Sync state** is current machine-readable status. It is rewritten on
  each `status` run. It must not become an audit log.
- **Sync event log** is the append-only audit trail. Engines append a new
  event each time they plan, apply, or emit Promotion metadata. They never
  mutate or reorder existing entries.

The Sync event log also records rejected attempts (`type:
"schema-rejected"`) so the audit trail covers invalid inputs, not just
successful operations.

### Invalid or unsupported schema versions

Engines must refuse unsupported schema versions before planning or
applying a Template update. The gate runs in this order:

1. Read every schema-versioned file the engine will consume:
   - Sync policy (`<derived>/.beztack/template.json`)
   - Origin baseline (`<derived>/.beztack/origin.json`)
   - Sync event log (`<derived>/.beztack/sync-event-log.json`, if present)
   - Template manifest (`<template-revisions>/<to>/template.json`, if present)
2. For each file, check `schemaVersion` against the engine's supported
   list. If absent or unsupported, abort with a clear error.
3. Validate the file body against its schema. If invalid, abort with a
   clear error.
4. If a Template manifest declares `compatibleEngines`, check that the
   engine's version falls inside the range. If not, abort.
5. Only after every gate passes may the engine plan or apply.

The fixture's self-check verifies the gate by constructing a synthetic
invalid Sync policy and asserting that the validator rejects it with a
clear message.

## Layout

```text
docs/template-sync-fixture/
├── README.md                          # this file
├── schemas/                           # JSON Schemas for engine I/O
│   ├── sync-policy.schema.json
│   ├── origin-baseline.schema.json
│   ├── sync-state.schema.json
│   ├── apply-plan.schema.json
│   ├── promotion-metadata.schema.json
│   ├── sync-event-log.schema.json     # issue #30: append-only audit history
│   └── template-manifest.schema.json  # issue #30: compatibleEngines range
├── template-revisions/                # Template source snapshot per revision
│   ├── v1.1.0/                        # last accepted (Origin baseline)
│   │   ├── template.json              # Template manifest (issue #30)
│   │   ├── packages/auth/session.ts
│   │   ├── apps/api/routes.ts
│   │   ├── .env.contract.json
│   │   └── package.json
│   └── v1.2.0/                        # candidate
│       ├── template.json              # Template manifest (issue #30, #34: declares migrations)
│       ├── packages/auth/session.ts
│       ├── apps/api/routes.ts
│       ├── apps/api/middleware.ts     # NEW
│       ├── .env.contract.json
│       └── package.json
├── beztack/                           # Beztack-owned fixture data (issue #32)
│   └── derived-project-registry.json  # Beztack-owned Trusted Derived project registry
├── derived-project/                   # Derived project state
│   ├── .beztack/
│   │   ├── template.json              # Sync policy
│   │   ├── parameters.json            # Template parameters
│   │   ├── origin.json                # Origin baseline (v1.1.0)
│   │   ├── sync-state.json            # current Sync state
│   │   ├── sync-event-log.json        # issue #30: append-only audit history
│   │   ├── migrations/                # issue #34: migration marker files
│   │   │   └── v1.2.0-applied         # marker for the idempotent v1.2.0 Environment contract migration
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

### Template migrations (issue #34)

Template migrations are declared separately from Template-owned file
content per PRD-27 stories 37-39. The Template manifest's `migrations[]`
field is a first-class array: each migration has an `id`, a `mode`
(`automatic` or `manual`), an `idempotency` check (file-exists,
marker-present, or command-succeeds), an optional `dryRun` preview
command, an `applyCommand` the human reviews, and metadata flags
(`interactive`, `destructive`, `trustClass`). The engine never executes
migrations; it evaluates the idempotency check at status time and
reports `idempotencyStatus: pending | already-applied`.

The fixture's `v1.2.0` Template manifest declares three migrations that
exercise the contract:

| Migration id | Mode | Idempotency check | Idempotency status | Execution (Trusted) | Execution (Community) |
|--------------|------|--------------------|--------------------|---------------------|-----------------------|
| `marker-environments-contract-v1.2.0` | automatic | file-exists `.beztack/migrations/v1.2.0-applied` | already-applied (fixture ships the marker) | engine-surfaces-only | manual-execution-required |
| `rotate-webhook-signing-secret` | manual | marker-present `.beztack/migrations/webhook-secret-rotated-at` (looking for `v1.2.0`) | pending | manual-execution-required | manual-execution-required |
| `register-trusted-only-secrets-bundle` | manual | command-succeeds `pnpm beztack secrets:bundle --version 1.2.0 --check` (engine does not run) | pending | manual-execution-required | manual-execution-required |

The second migration is `interactive: true` and `destructive: true`, so
it forces `manual-execution-required` regardless of trust class. The
third declares `trustClass: "trusted"`, so the engine surfaces the
trust restriction explicitly in `MIGRATIONS.md` for Community Derived
projects.

When the engine plans an apply it emits `migrations[]` in both
`sync-state` and `apply-plan` JSON. `apply --worktree` writes
`MIGRATIONS.md` into the worktree documenting every migration with its
idempotency check, dry-run command, apply command, and the explicit
reviewer action. The engine never executes migrations on either Trusted
or Community Derived projects.

### Promotion metadata (issue #33)

The engine must produce metadata conforming to
`schemas/promotion-metadata.schema.json` and matching
`expected/promotion-metadata.json` for a source PR labelled
`promotion: candidate`. The Promotion label is the authoritative
opt-in signal per issue #33; the engine refuses to emit metadata
without one.

Key invariants from issue #33:

- **`label`** is the Promotion label applied to the source PR
  (`promotion: candidate`). The engine refuses to emit Promotion
  metadata without `--label` (or `BEZTACK_PROMOTION_LABEL`).
- **`sourcePR` / `sourcePRs[]`** capture every PR or issue link on
  the Derived project that contributes to the Promotion. `--source-pr`
  is repeatable; the first link is mirrored in `sourcePR`.
- **`entryMode`** records how the source PR entered Beztack:
  `normal-pr` (default), `patch` (Community maintainers), or
  `trusted-automation` (Trusted maintainers using Beztack-owned
  automation). Beztack review is required in every case (ADR-0006).
- **`candidates`** lists only files on Template-owned paths; **Mixed-with-seam**
  paths surface as `mixed-protected-by-seam`, **Mixed-without-seam**
  paths surface as `platform-extraction-required` (issue #33
  distinguishes Promotion from Platform extraction), **Custom-owned**
  Product-domain files surface as `custom-owned-product-domain`,
  and conflicting overlapping rules surface as `ownership-ambiguous`.
- **`skipped`** lists every excluded file with its reason, so the
  reviewer can confirm the Custom-owned Product-domain files did not
  flow into the Template source.
- **`checks[]`** records both engine-internal validation
  (`source: "engine"`) and any upstream PR CI checks the caller passed
  via `--check NAME=RESULT` (`source: "upstream-pr-ci"`).
- **`trust`** is the Beztack-owned registry decision (issue #32); trust
  is one-way, so `--trust-class trusted` for an ID absent from the
  registry is refused even with a Promotion label.
- **`relatedPromotions[]`** lists overlapping Promotions from other
  Derived project IDs, linked for reviewer awareness rather than
  auto-deduplicated.

Fixture invariants:

- `trustClass: "trusted"` because the Derived project ID is on the
  Trusted Derived project registry.
- `label: "promotion: candidate"` (the documented Promotion label).
- `entryMode: "normal-pr"` (default; the Trusted Derived project could
  alternatively supply `--trusted-automation` to switch to
  `trusted-automation`).
- `sourcePRs` and `sourcePR` mirror the first `--source-pr` value.
- `candidates` lists only files on Template-owned paths:
  `packages/util/retry.ts`, `packages/util/package.json`.
- `skipped` lists Custom-owned Product-domain files
  (`apps/checkout/index.ts`, `apps/checkout/payment-handler.ts`,
  `apps/checkout/README.md`) with reason `custom-owned-product-domain`.
- `checks` records the schema and ownership validation checks the engine
  ran, each tagged `source: "engine"`. The caller can append
  `--check NAME=RESULT` entries which the engine tags
  `source: "upstream-pr-ci"`.
- `suggestedTemplateVersionImpact: "minor"` because the candidates add a
  reusable Template-owned capability (PRD #27 minor semantics).

## How an engine uses this fixture

A conforming engine implementation, given this fixture, must:

1. Validate every schema-versioned input file before planning or applying.
   Refuse unsupported schema versions with a clear error.
2. Read `derived-project/.beztack/template.json` as the Sync policy.
3. Read `derived-project/.beztack/parameters.json` as Template parameters.
4. Read `derived-project/.beztack/origin.json` as the Origin baseline.
5. Read `derived-project/.beztack/sync-event-log.json` (if present) as
   the append-only audit history. Engines must never reorder or mutate
   existing entries; they may only append.
6. Read each `template-revisions/<version>/template.json` as the Template
   manifest. Refuse the update if the manifest's `compatibleEngines`
   range excludes the engine version.
7. Read both `template-revisions/v1.1.0/` and `template-revisions/v1.2.0/`
   as the Template source revisions.
8. Treat `derived-project/` as the working tree.
9. Emit `expected/status.json` (or an equivalent) for `status`.
10. Emit `expected/apply-plan.json` (or an equivalent) for `apply --plan`.
11. Emit `expected/promotion-metadata.json` (or an equivalent) for a PR
    labelled `promotion: candidate`.
12. Append events to `derived-project/.beztack/sync-event-log.json` for
    each planning, apply, and Promotion action (engines that plan may
    not yet write the log on planning alone — issue #30 only specifies
    the schema contract, not when events are appended).
13. Regenerate `pnpm-lock.yaml` in the Derived project locally; never copy
    a lockfile from the Template source.

Engines under test must NOT add tool-specific metadata to the working
tree (no `.copier-answers.yml`, `.cruft.json`, etc.) as part of running
this fixture; the fixture's `derived-project/` state is what it is.

## Acceptance criteria mapping (issue #30)

| Issue #30 acceptance criterion                                              | Fixture artifact / test                                                              |
|-----------------------------------------------------------------------------|---------------------------------------------------------------------------------------|
| Explicit schema versions on Sync policy, Sync state, Origin baseline, Sync event log | `sync-policy.schema.json`, `sync-state.schema.json`, `origin-baseline.schema.json`, `sync-event-log.schema.json` all pin `schemaVersion: "1.0"` |
| Origin baseline defined around Template revision first, file metadata only as supporting drift evidence | `origin-baseline.schema.json` description and required-field order (`templateRevision`, `templateRevisionRef`, `acceptedAt`, `files`) |
| Sync state records current status without becoming an audit log              | `sync-state.schema.json` has no `events[]` field; `sync-event-log.schema.json` is the separate audit history |
| Sync event log records append-only sync and Promotion events without becoming current state | `sync-event-log.schema.json` is `events[]` only, marked append-only; not consumed as current state |
| Sync engine version recorded separately from Template version               | `sync-state.json#syncEngine`, `apply-plan.json#syncEngine`, `sync-event-log.json#events[].syncEngine`; Template version lives in `templateRevision` / `version` / `fromRevision` / `toRevision` |
| Template versions can declare compatible Sync engine version ranges         | `template-manifest.schema.json#compatibleEngines.minimum` / `.maximum`; `template-revisions/v1.1.0/template.json`, `template-revisions/v1.2.0/template.json` |
| Invalid or unsupported schema versions fail before planning or applying     | `validate.mjs` gate in `docs/template-sync-spike/custom-engine/`; `fixture.test.mjs` tests that an invalid `schemaVersion` is rejected |
| Specification validated against the Sync engine contract fixture            | All new schemas live next to the existing fixture schemas and are exercised by `fixture.test.mjs` |

## Acceptance criteria mapping (issue #32)

| Issue #32 acceptance criterion                                                       | Fixture artifact / test                                                                                                                  |
|--------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------|
| Stable opaque Derived project ID generated once for a Derived project                | `origin.derivedProjectId` = `dp_01HMVBEZTACK0000000000000A` (opaque, not derived from repo name or URL); `identity-registry.test.mjs` "stable opaque Derived project ID" |
| How project renames or remote URL changes affect traceability                        | Registry entry records `canonicalUrl` + `knownUrls`; Derived project ID stays the same across renames; `identity-registry.test.mjs` "Derived project ID stays stable when the canonical URL changes" |
| Trusted Derived project registry is Beztack-owned, not self-declared                  | `beztack/derived-project-registry.json` lives outside the Derived project tree; engine refuses self-declared `--trust-class trusted`; `identity-registry.test.mjs` "Beztack-owned registry file exists outside the Derived project tree" |
| Registry records enough metadata to identify trusted repositories and trust class    | `derivedProjectId`, `trustClass`, `repository.{canonicalUrl,knownUrls,displayName}`, `addedAt`, `addedBy`, `governanceNotes`; `identity-registry.test.mjs` "registry entries record canonicalUrl, knownUrls, and trust class metadata" |
| Copied Community Derived project with the same ID does NOT receive trusted status    | Engine defaults to `community` for IDs absent from the registry and refuses `--trust-class trusted` for them; `identity-registry.test.mjs` "copied Community Derived project with same trusted ID does NOT receive trusted status" |
| Trusted Derived projects targetable for automated update notification                | Registry records `canonicalUrl` per Trusted entry; engine surfaces it in `sync-state.trust.repository.canonicalUrl`; `identity-registry.test.mjs` "Trusted Derived projects are targetable for automated update notification" |
| Community Derived projects remain supported through release notes and local tooling  | Engine still runs for community IDs; status/apply/promotion validate; `identity-registry.test.mjs` "Community Derived projects are supported through local tooling" |
| Validated against the schema-versioned Sync state contract                           | `derived-project-registry.schema.json` pins `schemaVersion: "1.0"`; `sync-state`, `apply-plan`, `promotion-metadata` schemas all pin the trust block; `identity-registry.test.mjs` "registry file validates against the derived-project-registry schema" and "schemas refuse additional properties on the trust block" |

## Acceptance criteria mapping (issue #34)

| Issue #34 acceptance criterion                                              | Fixture artifact / test                                                              |
|-----------------------------------------------------------------------------|---------------------------------------------------------------------------------------|
| Template migrations represented separately from Template-owned file content | `template-manifest.schema.json#migrations`; `fixture.test.mjs` "issue #34: migrations declared on the Template manifest are separate from Template-owned file content" |
| Template version declares migration steps + automatic/manual mode           | `template-revisions/v1.2.0/template.json#migrations[].mode`; `fixture.test.mjs` "issue #34: Template manifest declares migrations with mode and idempotency" |
| Migration steps have a dry-run mode or equivalent preview behavior           | `template-manifest.schema.json#migration.dryRun`; `status.migrations[].dryRunCommand`; `MIGRATIONS.md` rendered by `apply --worktree` |
| Migration steps define idempotency checks or conditions                     | `template-manifest.schema.json#migration.idempotency`; engine evaluates file-exists, marker-present, command-succeeds; `migration-flow.test.mjs` |
| Unsafe or interactive migrations reported as manual steps instead of running automatically | `migration.interactive`, `migration.destructive`; `execution: "manual-execution-required"`; `migration-flow.test.mjs` |
| Community Derived projects require explicit local execution                  | `evaluateExecution(migration, "community")` always returns `manual-execution-required`; `MIGRATIONS.md` includes the explicit-local-execution warning for community projects |
| Migration status appears in `status` or `apply` output as part of the recommended next action | `sync-state.schema.json#migrations`; `apply-plan.schema.json#migrations`; `recommendation.action: "review-migrations"`; `status.recommendation.note` mentions migrations |
| Behavior covered by the Sync engine contract fixture                        | `expected/status.json#migrations`, `expected/apply-plan.json#migrations`; `migration-flow.test.mjs`; `fixture.test.mjs` issue #34 tests |

## Acceptance criteria mapping (issue #33)

| Issue #33 acceptance criterion                                                                                                       | Fixture artifact / test                                                                                                                                          |
|-------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| A Promotion label on a Derived project PR is the authoritative opt-in signal                                                       | Engine refuses `promotion-metadata` without `--label` (exit 6); `promotion-flow.test.mjs` "issue #33: Promotion label is the authoritative opt-in signal"     |
| Promotion candidates are filtered by ownership: Template-owned paths and unprotected parts of Mixed ownership                      | `candidates[]` only includes `packages/util/*` (Template-owned); `promotion-flow.test.mjs` "issue #33: Promotion candidates are filtered to Template-owned paths" |
| Custom-owned Product domain changes are skipped by default and reported clearly                                                    | `skipped[]` lists `apps/checkout/*` with reason `custom-owned-product-domain`; `promotion-flow.test.mjs` "issue #33: Custom-owned Product domain changes are skipped by default" |
| Promotion metadata includes source project identity, trust class, source PR or issue links, baseline revision, files touched (candidates+skipped), resolved ownership, skipped files, checks run, suggested Template version impact, and related overlapping Promotions | `promotion-metadata.schema.json#derivedProjectId / trustClass / sourcePR / sourcePRs / baselineRevision / candidates / skipped / checks / suggestedTemplateVersionImpact / relatedPromotions`; `promotion-flow.test.mjs` issue #33 metadata coverage tests |
| Community Derived project Promotions enter as normal PRs or patches and are validated by Beztack CI                                | `--community-entry-mode patch` → `entryMode: "patch"`; default is `normal-pr`; `promotion-flow.test.mjs` "issue #33: Community Derived project + --community-entry-mode patch" |
| Trusted Derived project Promotions optionally using trusted automation while still requiring Beztack review                          | `--trusted-automation` → `entryMode: "trusted-automation"`; engine warns and ignores when trust is community; `promotion-flow.test.mjs` "issue #33: Trusted Derived project + --trusted-automation" |
| Overlapping Promotions are linked for reviewer awareness rather than auto-deduplicated                                             | `--related-promotion DERIVED_PROJECT_ID,LABEL` repeatable; engine never deduplicates; `promotion-flow.test.mjs` "issue #33: related Promotions are linked in metadata, not auto-deduplicated" |
| The flow distinguishes Promotion from Platform extraction                                                                            | `skipped[]` reasons include `platform-extraction-required` for Mixed-without-seam paths; `formatPromotionMarkdown` and the human view render the distinction; `promotion-flow.test.mjs` "issue #33: Mixed-without-seam paths are surfaced for Platform extraction" and "issue #33: human-readable Promotion metadata renders the Promotion flow" |

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
- Every issue #30 acceptance criterion is covered by at least one
  fixture case: the new schemas exist, the Sync event log and Template
  manifests validate, the Sync engine version is recorded separately,
  and an invalid schema version is rejected by the validator.

Run with Node's built-in test runner (no external dependencies):

```bash
node --test docs/template-sync-fixture/tests/fixture.test.mjs
```
