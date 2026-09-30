# Template Sync inspection harness

> Issue: [#36 — Template sync: Prototype agent-assisted sync inspection harness against real lncd](https://github.com/V473r10/beztack/issues/36)
>
> Parent PRD: [#27 — Template Sync System](https://github.com/V473r10/beztack/issues/27)
>
> Domain model: [`CONTEXT.md`](../../CONTEXT.md) — Template Sync glossary
>
> Pivot note: this harness is the read-only evidence layer. It deliberately
> does **not** replace the `docs/template-sync-spike/custom-engine/`
> prototype and is **not** a productionized Sync engine.

A `Sync inspection harness` is a small Node-based tool that gathers
`Structural sync evidence` from a local Derived project checkout against an
explicit pair of Template revisions in a Template source. It does not
mutate the Derived project, does not rewrite `.beztack/origin.json`, does
not infer a Template revision from hash-only legacy data, and does not
treat generic CLI tags as Template revisions.

The output is a `Sync inspection report`: stable JSON is primary;
Markdown is a derived human view.

## What it is

- A **read-only** evidence-gathering harness run by an agent or a human
  reviewer against a local Derived project checkout.
- A **decision-support** artefact: the report lists candidates and
  suggested next actions, each gated on explicit user approval.
- A **fixture-friendly** prototype: the included
  `scripts/template-sync/fixtures/legacy-derived/` synthetic project
  exercises every recognised metadata shape, ownership rule, and seam
  detection branch without depending on lncd.

## What it is not

- **Not** a Sync engine. It does not plan, validate, or apply updates.
- **Not** a PR-creation tool. It never opens, prepares, or pushes a PR.
- **Not** an Origin baseline rewriter. It never touches
  `.beztack/origin.json`.
- **Not** a Template revision inferrer. Hash-only legacy origin data is
  evidence of compatibility, not proof of an accepted Template revision.
- **Not** an approver. Its report does not declare an update safe to
  apply. Every suggested next action is flagged `requiresApproval`.

## CLI

```text
node scripts/template-sync/inspect.mjs \
  --derived <path> \
  [--from <ref|commit>] [--to <ref|commit>] \
  [--template-source <path>] \
  [--json | --markdown] \
  [--output <path>]
```

| Flag                       | Required | Meaning                                                              |
|----------------------------|----------|----------------------------------------------------------------------|
| `--derived <path>`         | yes      | A local Derived project checkout. The harness reads but never writes. |
| `--from <ref>`             | optional | The explicit Template revision to compare against.                   |
| `--to <ref>`               | optional | The explicit Template revision to compare to.                        |
| `--template-source <path>` | optional | A local Template source checkout. Defaults to the current working dir. |
| `--json`                   | default  | Emit JSON to stdout.                                                  |
| `--markdown`               | optional | Emit a derived Markdown view to stdout.                               |
| `--output <path>`          | optional | Write to a file instead of stdout.                                    |

`--from` and `--to` accept:

- a commit hash (`HEAD~1`, `c104f6c…`),
- a branch (`main`, `feature/...`) — resolves through `git show-ref`,
- a `refs/...` ref (`refs/tags/v1.2.0`) — explicit, treated as
  `exact-refs`,
- a bare `v0.1.0` tag — treated as `tag-disallowed` because generic
  repository tags are not designated Template revisions; the harness
  surfaces a `rationale` and asks the user to pass an explicit Template
  ref instead.

If `--from` and/or `--to` are missing or unresolvable, the report
records `comparisonBasis.status` as `missing`, `partial`, or
`tag-disallowed`, and degrades to metadata + ownership + seam evidence
without claiming a complete Template diff.

## Output

The JSON form (stable shape `schemaVersion: "1.0"`) carries:

- `harness` — name and version of the inspector.
- `derivedProject.metadata` — manifest shape (`current` | `legacy` |
  `missing` | `unknown`), origin shape (`current` | `legacy-hash-only` |
  `missing` | `unknown`), and a list of human-readable observations.
  Hash-only origin and `templateId/currentVersion/strategyByPath/customZones/appliedMigrations`
  are always classified as `Legacy sync metadata`, never as corruption.
- `comparisonBasis` — `resolved` | `missing` | `partial` |
  `tag-disallowed`, the per-flag resolution, and a `note` explaining
  what kind of comparison is safe to draw.
- `ownership` — `current-policy` | `provisional-resolved-from-legacy-strategy-by-path`
  | `none`, with rule counts, overlap count, per-strategy breakdown,
  `customZones` evidence (always human notes, never executable), and a
  `seams[]` list (`nitro-fs-routing` for now).
- `candidates[]` — one entry per observed file:
  `path`, `category` (one of five buckets), `ownership` with
  specificity-based confidence, `drift` against the resolved Template
  revisions (or an explicit "basis missing" reason), `reasons[],
  suggestedChecks[], nextActions[]` — every action flags
  `requiresApproval: true`.
- `summary` — counts by category.
- `suggestedNextActions[]` — risk-tagged actions a reviewer can pick
  up, all gated on explicit user approval.
- `guarantees` — a frozen object asserting read-only behaviour
  (does-not-mutate-derived-project, does-not-rewrite-origin-baseline,
  does-not-infer-Template-revision, does-not-treat-generic-CLI-tags,
  report-is-not-an-approval).

The Markdown form is a derived view: same data, narrative rendering.
JSON is the source of truth.

## Run it

```bash
# Self-check (no lncd required):
node --test scripts/template-sync/tests/inspect.test.mjs

# Against the synthetic fixture (synthetic; safe to commit):
node scripts/template-sync/inspect.mjs \
  --derived scripts/template-sync/fixtures/legacy-derived

# Against a real local Derived project:
node scripts/template-sync/inspect.mjs \
  --derived /path/to/local/derived \
  --template-source /path/to/local/template \
  --from HEAD~1 --to HEAD --markdown
```

The harness refuses to do anything if `--derived` is omitted. It
exits non-zero on bad usage.

## What it does not promote

- This harness is **not** productionized. It is a pivot check against
  issue #36 to evaluate whether a read-only evidence layer plus an
  agent workflow is enough to make Template sync review decisions
  without standing up an apply engine.
- This harness is **not** CI. There is no plan to graft it onto
  `docs/template-sync-spike/custom-engine/`, move the spike into
  `packages/`, or wire it into Beztack's lint pipeline.
- This harness is **not** a `Baseline reset` tool. It records
  hash-only origin as legacy evidence; it never proposes rewriting
  `.beztack/origin.json`.

## What to do with the output

Read [`sync-review-workflow.md`](sync-review-workflow.md). It is the
agent- and human-facing guide for interpreting reports, presenting
options, and asking for explicit approval before any mutation.
