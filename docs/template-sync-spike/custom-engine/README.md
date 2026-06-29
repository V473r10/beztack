# Custom engine prototype

> Part of the [build-vs-adopt spike](../README.md). Implements the
> engine-agnostic fixture contract from
> [`../../template-sync-fixture/`](../../template-sync-fixture/) in a
> small Node-based CLI.
>
> Issues: [#31 — Template sync: Prove PR-only status/apply flow](https://github.com/V473r10/beztack/issues/31), [#34 — Template sync: Model Template migrations safely](https://github.com/V473r10/beztack/issues/34), [#32 — Template sync: Add Trusted Derived project identity and registry](https://github.com/V473r10/beztack/issues/32), [#35 — Template sync: Add Sync seams for lncd wiring drift](https://github.com/V473r10/beztack/issues/35)
> Parent PRD: [#27 — Template Sync System](https://github.com/V473r10/beztack/issues/27)

## What this is

A prototype that demonstrates the **PR-only Template update flow** end to
end against the engine-agnostic fixture. It is intentionally minimal:

- Reads the fixture (no real Git, no real GitHub API).
- Emits three primary outputs: `status`, `apply`, `promotion-metadata`.
- `status` and `apply` both have a **stable JSON contract** for agents
  and CI and a **human-readable Markdown view** as a secondary view.
- `apply` has two modes:
  - `apply --plan` — emit the plan JSON only (no side effects).
  - `apply --worktree PATH` — prepare a PR-ready branch in a new
    directory, write the planned file updates, update the Origin
    baseline / Sync state / Sync event log in that directory, and write
    a `BRANCH_README.md` describing the work. The original Derived
    project is **never** mutated.
- `apply --worktree PATH --init-git` additionally initialises a Git
  repo in the worktree, creates the branch, and commits the changes.
- Validates every schema-versioned input and output through the
  validator from issue #30 and refuses unsupported schema versions
  before any planning or apply work.
- Does not push to a remote or open a PR. PR creation is a follow-up
  concern (see "What's still future work" below).

## Usage

```bash
# From the repo root:

# 1. Stable JSON status (for agents and CI).
node docs/template-sync-spike/custom-engine/beztack-sync.mjs \
  status --fixture docs/template-sync-fixture

# 2. Human-readable status (for humans and PR summaries).
node docs/template-sync-spike/custom-engine/beztack-sync.mjs \
  status --fixture docs/template-sync-fixture --format human

# 3. Apply plan only (no side effects).
node docs/template-sync-spike/custom-engine/beztack-sync.mjs \
  apply --plan --fixture docs/template-sync-fixture

# 4. Human-readable apply plan.
node docs/template-sync-spike/custom-engine/beztack-sync.mjs \
  apply --plan --fixture docs/template-sync-fixture --format human

# 5. PR-ready branch preparation (the new flow from issue #31).
node docs/template-sync-spike/custom-engine/beztack-sync.mjs \
  apply --worktree /tmp/example-derived-update \
  --fixture docs/template-sync-fixture

# 5b. Same, but also create a Git branch on top of the worktree.
node docs/template-sync-spike/custom-engine/beztack-sync.mjs \
  apply --worktree /tmp/example-derived-update --init-git \
  --fixture docs/template-sync-fixture

# 6. Promotion metadata.
node docs/template-sync-spike/custom-engine/beztack-sync.mjs \
  promotion-metadata --fixture docs/template-sync-fixture

# Compare to fixture expected/*.json (validates schemas and key semantics):
node docs/template-sync-spike/custom-engine/compare.mjs \
  docs/template-sync-fixture

# Run the new apply-flow tests (issue #31):
node --test docs/template-sync-spike/custom-engine/tests/apply-flow.test.mjs
```

## Options

- `--fixture PATH` — fixture root (default: `docs/template-sync-fixture`).
- `--from REV` — Origin revision (default: `v1.1.0`).
- `--to REV` — candidate revision (default: `v1.2.0`).
- `--derived-project PATH` — Derived project root (default:
  `<fixture>/derived-project`).
- `--registry PATH` — Beztack-owned Trusted Derived project registry
  (default: `<fixture>/beztack/derived-project-registry.json`). The
  engine refuses to run when the registry is missing or invalid
  (exit code 5).
- `--engine NAME VERSION` — overrides `syncEngine.name` and
  `syncEngine.version` in outputs. The validator gates every subcommand
  on `compatibleEngines` and aborts with exit code 4 if the engine
  version is below the Template minimum.
- `--trust-class trusted|community` — caller hint. The registry is the
  source of truth: the engine honors a downgrade (`trusted` registry
  entry + `--trust-class community`) and refuses an escalation
  (`--trust-class trusted` for an ID absent from the registry or with
  a revoked entry). Refusals exit with code 5.
- `--format json|human` — `json` is the default; `human` (alias:
  `md`, `markdown`) emits a Markdown view of `status` or the apply
  plan. `--worktree` mode also prints a one-line summary of what was
  prepared.
- `--worktree PATH` — apply mode only. Prepare a PR-ready branch in
  `PATH` (the engine refuses to overwrite an existing path).
- `--init-git` — apply + `--worktree` mode only. Initialise a Git repo
  in the worktree, create the branch, and commit the prepared changes.
- `--skip-validation` — skip the schema-validation gate (intended for
  internal debugging only; do not use in CI).

## The PR-only apply flow (issue #31)

The minimum PR-only Template update flow that issue #31 asks for lives
behind `apply --worktree PATH`. It does six things, in this order:

1. **Validate the gate.** Refuse to plan or apply unless every
   schema-versioned input (Sync policy, Origin baseline, Sync event
   log, target Template manifest) passes the issue #30 gate. Refuse
   if the manifest's `compatibleEngines` excludes the engine version.
2. **Copy the Derived project into a fresh directory.** The original
   Derived project is never mutated, so rollback is just
   `rm -rf` of the worktree.
3. **Apply the planned updates.** For each `update` in the plan:
   - **Seam-preserved files** (e.g. `apps/api/routes.ts`) take the
     candidate's harness and splice in the Derived project's seam
     region, so the new harness is in place and the Derived project's
     custom `registerRoute(...)` calls are preserved.
   - **`package.json`** is rendered from the candidate, with
     Template parameters (`{{appName}}` etc.) substituted from
     `.beztack/parameters.json`. Dependency keys are union-merged
     with the Derived project's `package.json` so custom workspace
     dependencies are preserved while Template-owned keys take
     precedence.
   - **All other Template-owned updates** are written verbatim from
     the candidate.
   - **Custom-owned files** are never touched.
   - **Conflict files** (Mixed ownership, no seam, both sides
     changed) are intentionally not modified in the worktree; the
     engine records the conflict in the plan, in the Sync event log,
     and in `BRANCH_README.md`.
4. **Update the Origin baseline in the worktree** so a future
   `status` against the worktree reports `currentRevision: v1.2.0` and
   refreshed per-file hashes.
5. **Update the Sync state in the worktree** so a future
   `status` against the worktree reports `currentRevision: v1.2.0`
   and `candidateRevision` is cleared.
6. **Append an `apply` event to the Sync event log in the worktree**,
   recording `fromRevision`, `toRevision`, `branch`, and the
   update / skip / conflict / blocker counts. Existing events are
   never reordered or mutated.

Lockfiles are deliberately **not** copied from the Template source.
The Template revisions in the fixture do not ship `pnpm-lock.yaml`,
and the engine records this in the Origin baseline and in
`BRANCH_README.md`, which explicitly tells the reviewer to run
`pnpm install --lockfile-only` (or the equivalent) before opening
the PR. See `CONTEXT.md` and ADR-0006 for the domain rationale.

## Layout

```text
custom-engine/
├── README.md
├── package.json
├── beztack-sync.mjs          # engine entry point
├── format.mjs                # human-readable Markdown formatters
├── prepare-branch.mjs        # PR-ready branch preparation
├── validate.mjs              # schema-validation gate (issue #30)
├── registry.mjs              # Beztack-owned Trusted Derived project registry (issue #32)
├── compare.mjs               # fixture-vs-engine comparator
└── tests/
    ├── apply-flow.test.mjs      # PR-only flow tests (issue #31)
    ├── migration-flow.test.mjs  # migration flow tests (issue #34)
    ├── identity-registry.test.mjs # identity + registry tests (issue #32)
    ├── promotion-flow.test.mjs  # promotion label and metadata tests (issue #33)
    └── seams-flow.test.mjs      # Sync seams tests (issue #35)
```

The comparator (`compare.mjs`) embeds a minimal JSON Schema validator
sufficient for the spike (enum + required + `additionalProperties: false`).
The new `apply-flow.test.mjs` uses a richer validator (type, const,
enum, required, additionalProperties, properties, items, $ref, $defs,
oneOf, allOf, pattern, date-time format) to validate the worktree's
schema-versioned outputs against the fixture schemas.

## What's still future work

- Real Git integration (`git fetch`, `git push`, PR creation via the
  GitHub API or the `gh` CLI). The engine currently stops at the
  branch / commit step; pushing and opening the PR is a follow-up
  concern that does not need to block the contract.
- Real `lncd` repository validation against the engine. Deferred in
  issue #28; the fixture is the only validation target for this spike.
- Replacement of the inline JSON Schema validator with `ajv` or
  another battle-tested validator. The current validator covers the
  subset used by the fixture schemas and is explicitly
  dependency-free.
- A CI workflow that runs `fixture.test.mjs`, `seams.test.mjs`,
  `apply-flow.test.mjs`, `migration-flow.test.mjs`,
  `identity-registry.test.mjs`, `promotion-flow.test.mjs`, and
  `seams-flow.test.mjs` on every PR.

## Trusted Derived project identity and registry (issue #32)

Trust is granted by Beztack through a Beztack-owned registry file. The
registry lives **outside the Derived project tree** and the engine
refuses to plan or apply without it.

### What the registry records

The registry maps each opaque stable `derivedProjectId` to a trust
class and the expected repository identity:

| Field                  | Purpose                                                                                       |
|------------------------|-----------------------------------------------------------------------------------------------|
| `derivedProjectId`     | Opaque stable ID generated at scaffolding. Survives renames.                                  |
| `trustClass`           | Always `"trusted"` in the registry. Community trust is the default when the ID is absent.    |
| `repository.canonicalUrl` | Current canonical remote URL. Beztack-owned tooling targets this for automated dispatch.    |
| `repository.knownUrls` | Full rename history. First entry is the canonical URL; subsequent entries are prior URLs.   |
| `repository.displayName` | Optional human-readable name. Distinct from the URL.                                      |
| `addedAt`              | When Beztack granted trust.                                                                   |
| `addedBy`              | Beztack-owned identity that granted trust (never self-declared).                              |
| `governanceNotes`      | Optional rationale (PR link, scope, etc.).                                                     |
| `revokedAt`            | Optional revocation timestamp. Revoked entries default to community trust for audit.        |

### How the engine uses the registry

1. The engine loads the registry before any other step (including the
   schema gate) and refuses to run with exit code 5 if the file is
   missing or fails `derived-project-registry.schema.json` validation.
2. The registry decides the canonical trust class. The
   `sync-state.trust.trustClass` field records the grant; the
   `sync-state.trust.effectiveTrustClass` field records what the engine
   actually used for the current run.
3. A caller-provided `--trust-class` flag is honored only when it does
   not escalate trust beyond the registry grant. A Trusted maintainer
   can pass `--trust-class community` to opt out of trusted dispatch
   for a single run; a Community project cannot pass
   `--trust-class trusted` to opt in.
4. Every output (`status`, `apply --plan`, `apply --worktree`,
   `promotion-metadata`) includes a structured `trust` block that
   references the registry ID and version, exposes the trust class
   source, and records the repository identity. The `BRANCH_README.md`
   documents the opaque-ID invariant and the rename history.

### Why this matters for one-way trust

The registry is the **only** source of truth for trust decisions. A
Derived project owner cannot self-declare trusted status by reusing
or guessing a `derivedProjectId` — the engine refuses the escalation
and exits with code 5. The same restriction prevents a copied
Community Derived project from inheriting the trust of the original
Trusted project: if the registry does not list the ID (or lists it
as revoked), trust defaults to community regardless of any project-side
declaration.

### ID stability across renames

The `derivedProjectId` is generated once at scaffolding and never
reused. Renaming the GitHub repository or moving the remote URL does
NOT change the ID; the Origin baseline, Sync state, Sync event log,
and Promotion metadata keep the same ID across renames. To preserve
audit history, the registry entry's `repository.knownUrls` records
every URL the project has used, with the canonical URL as the first
entry.

## Template migration flow (issue #34)

The engine surfaces Template migrations as a first-class part of the
`status` and `apply` outputs and writes `MIGRATIONS.md` to the apply
branch, but it **never executes** migrations. The flow is:

1. **Schema gate** — the Template manifest's `migrations[]` is validated
   alongside every other schema-versioned file (issue #30). The engine
   refuses manifests with rogue fields on migration entries.
2. **Idempotency evaluation** — for each migration, the engine evaluates
   the declared idempotency check (`file-exists`, `marker-present`, or
   `command-succeeds`) against the Derived project without running any
   migration command. The result lands in `sync-state.migrations[]` as
   `idempotencyStatus: pending | already-applied`.
3. **Execution mode** — `interactive: true` or `destructive: true`
   force `execution: "manual-execution-required"`. Community Derived
   projects also force every migration to `manual-execution-required`
   regardless of declared mode. Trusted Derived projects may treat
   automatic, non-interactive, non-destructive migrations as
   `engine-surfaces-only`.
4. **Recommended action** — when at least one migration is pending and
   `manual-execution-required`, the status `recommendation.action`
   becomes `review-migrations`; conflicts still take precedence when
   present.
5. **Worktree documentation** — `apply --worktree` writes
   `MIGRATIONS.md` next to `BRANCH_README.md`. The file lists every
   migration with its idempotency check, dry-run command, apply command,
   and the explicit reviewer action. For Community Derived projects the
   file includes a callout that the maintainer must run every migration
   step locally; for Trusted Derived projects the file notes when
   trusted automation is allowed.
6. **PR-only** — migrations never cause direct mutation of a Derived
   project's main branch. The engine surfaces them; humans run them.

## Sync seams for routing and module wiring drift (issue #35)

The existing lncd wiring drift is treated as **evidence of missing Sync
seams**, not as something to hide with Baseline reset or by marking the
files Custom-owned. The engine supports multiple Sync seams per file
and preserves every seam region verbatim during `apply --worktree`:

- `apps/api/routes.ts` declares both `api-route-registration`
  (issue #31) and `product-route-registration` (issue #35). The engine
  preserves both `registerRoute(...)` and `registerProductRoute(...)`
  calls during a Template update.
- `apps/api/products.ts` is a new Template-owned file with the
  `product-module-registration` seam. Derived projects register
  `registerProductModule(...)` calls here without editing Template-owned
  wiring directly.
- `apps/api/middleware.ts` is preserved as the **negative case**: Mixed
  ownership, no seam registered, drift surfaced as a Sync conflict.
  The right fix is to register a seam (as `apps/api/products.ts`
  demonstrates), NOT to mark the file Custom-owned to hide the drift.

The schemas gain optional `seams[]` arrays on `status.files[].seams`
and `apply-plan.updates[].seams`. The primary `seam` field still exists
(and mirrors the first seam id) for backward compatibility; engines
that understand multiple seams populate `seams[]` in policy order.

The `apply --worktree` flow extracts each seam region by id (e.g.
`api-route-registration seam`, `product-route-registration seam`,
`product-module-registration seam`) and splices them onto the candidate
harness in policy order. The `BRANCH_README.md` lists every preserved
seam in a dedicated section, and the engine's `result.seamsPreserved`
array names each one explicitly.

Layout:

```text
custom-engine/
├── README.md
├── package.json
├── beztack-sync.mjs          # engine entry point
├── migrations.mjs            # issue #34: migration evaluation + MIGRATIONS.md formatter
├── format.mjs                # human-readable Markdown formatters
├── prepare-branch.mjs        # PR-ready branch preparation
├── validate.mjs              # schema-validation gate (issue #30)
├── compare.mjs               # fixture-vs-engine comparator
└── tests/
    ├── apply-flow.test.mjs   # PR-only flow tests (issue #31)
    └── migration-flow.test.mjs # migration flow tests (issue #34)
```
