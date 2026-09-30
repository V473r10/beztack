# Sync review workflow

> Companion to [`README.md`](README.md) for the `Sync inspection harness`.
>
> Issue: [#36 — Template sync: Prototype agent-assisted sync inspection harness against real lncd](https://github.com/V473r10/beztack/issues/36)
>
> Domain model: [`CONTEXT.md`](../../../CONTEXT.md) — Template Sync glossary
>
> This document is the `Sync review workflow`. It is a versioned
> operational guide, not a source of truth like `Sync policy` or
> `Origin baseline`. It does not authorise mutation.

This workflow describes how an agent or human should read the
`Sync inspection report` produced by the `Sync inspection harness`,
present options to a reviewer, and only proceed after explicit
approval of a concrete option.

## Step 0. Locate the harness output

Pick up the most recent report for the Derived project under review.
Default location is the stdout of the harness invocation. If you need
persistence, write JSON to a file under `docs/template-sync-harness/runs/<date>-<derived>/report.json`
and a derived Markdown view next to it.

Persist only `Structural sync evidence`. Never persist the full
Derived project, code excerpts, secrets, or Product domain data
alongside the report.

## Step 1. Confirm `guarantees` are present

Every well-formed report carries a top-level `guarantees` object with:

```json
{
  "readOnly": true,
  "didNotMutateDerivedProject": true,
  "didNotRewriteOriginBaseline": true,
  "didNotInferTemplateRevision": true,
  "didNotTreatGenericTagsAsTemplateRevisions": true,
  "reportIsNotAnApproval": true
}
```

If any of those is missing or false, **stop** and re-run the harness.
Do not interpret the report as evidence.

## Step 2. Read metadata first

Look at `derivedProject.metadata`:

| Manifest shape          | Origin shape        | Reading                                              |
| ----------------------- | ------------------- | ---------------------------------------------------- |
| `legacy`                | `legacy-hash-only`  | Recognised older template sync metadata. Use Provisional ownership resolution. Never infer a Template revision from hashes. |
| `legacy`                | `missing`           | Manifest is legacy; origin was not committed. Run a manual review. |
| `current`               | `current`           | Sync policy and Origin baseline are present in the declared shape. Strict reading. |
| `current`               | `legacy-hash-only`  | Mixed shape; treat the legacy origin as evidence, not as a baseline until reconciled. |
| `missing` / `unknown`   | (any)               | No contract surface available. Ask the user before recommending any change. |

The `legacyObservations[]` array carries the harness's structured
explanation. Quote the items verbatim when discussing findings so the
user sees the same words the harness recorded.

## Step 3. Read the comparison basis

| `comparisonBasis.status` | Reading                                                |
| ------------------------ | ------------------------------------------------------ |
| `resolved`               | Both `--from` and `--to` resolved to explicit Template revisions. Drift candidates are trustworthy. |
| `tag-disallowed`         | One of the revisions was a generic CLI tag. The harness recorded the evidence but does not treat the comparison as authoritative. Ask the user to pass a commit, branch, or `refs/...` ref. |
| `partial`                | Only one side resolved. Report makes only the resolved side observable. |
| `missing`                | Neither side was passed. Downgrade the review to metadata + ownership + seam observations; do not claim a Template diff. |

A `missing` basis is **not** a failure of the harness — it is a
deliberate downgrade. The report still carries enough evidence for the
reviewer to act on metadata and seams; it just cannot claim "this
file changed between two Template revisions".

## Step 4. Read ownership and seams

Look at `ownership`:

- `shape` — `current-policy` (strict), `provisional-resolved-from-legacy-strategy-by-path`
  (Provisional, with overlap evidence), or `none` (no evidence available).
- `overlapsCount` — number of files where multiple legacy rules matched
  with equal specificity. Each overlap means a reviewer must decide.
- `ruleCountByStrategy` — how many observed files fall under
  `custom-owned` / `template-owned` / `mixed` / `unresolved`.
- `seams[]` — currently `nitro-fs-routing` for Nitro filesystem
  routing under `apps/api/server/routes/**`. A Filesystem sync seam
  is a recognised seam; treat new files there as candidates for
  Filesystem sync seam handling, not as edits to a central
  `routes.ts` registry.
- `customZones` — human notes from legacy metadata. Treat them as
  context, **never** as executable ownership rules.

## Step 5. Walk candidates by category

The five categories are:

- `Low-risk update candidate` — Template-owned, no observed
  Template or Derived project drift, normal review-and-check path.
  Still requires user approval before any mutation.
- `Review-required update candidate` — observed drift, ambiguous
  ownership, or framework impact. Ask the user to choose between
  `accept Template update`, `keep Derived project version`, or
  `open a Platform extraction review`.
- `Custom-owned/Product domain` — confirmed Product domain territory.
  Do not propose a Template-owned update; keep under Derived project
  ownership.
- `Mixed ownership` — requires seam analysis or explicit conflict
  handling. Files inside an observed Filesystem sync seam should be
  classified through the seam, not through a marker region.
- `Platform extraction candidate` — observed Filesystem sync seam
  pressure that may belong in the Template source, but only after
  Platform extraction design. Never copy Product domain code
  directly into the Template source.

For each candidate, follow the recorded `nextActions[]`. Every entry
carries `risk` (`low` | `medium` | `high`) and `requiresApproval:
true`.

## Step 6. Do not auto-apply anything

The harness has no apply capability, and neither does this workflow.
The only mutation paths are:

1. **Mutating the Derived project** (edit a file). This is a Template
   update review decision. Always ask the reviewer to pick one of:
   - `accept Template update` — overwrites the file with the new
     Template source content.
   - `keep Derived project version` — leaves the file untouched and
     leaves the drift on record.
   - `open a Platform extraction review` — only valid for Platform
     extraction candidates; requires a separate design ticket.
2. **Updating the Origin baseline.** Reserved for an explicit Baseline
   reset. The harness never proposes this on its own; the reviewer
   must accept a Template revision explicitly before any Origin
   baseline entry is rewritten.
3. **Migrating the Derived project to a new Sync policy shape.** A
   one-time, reviewed migration, not a per-update action.

## Step 7. Persist evidence, not data

When you record the review, persist **only** the JSON report plus the
chosen actions, plus the answers to your approval questions. Do not
attach:

- Full project snapshots,
- Code excerpts,
- Secrets, env files, `.env.example`,
- Product domain data dumps.

This keeps the Template source repository a place for Structural sync
evidence, not a leak path for Derived project internals.

## Step 8. When in doubt, ask

If the report, the harness, or the user's intent is unclear, ask the
user. The harness and this workflow are designed to make review
faster by surfacing structure, not to remove the reviewer from the
loop. The reviewer is the source of truth for each decision; the
harness is evidence for them, not a substitute for them.

## Out of scope

This workflow does **not** authorise:

- Productionizing the `docs/template-sync-spike/custom-engine/`
  prototype,
- Moving the spike into `packages/`,
- Wiring the harness into CI,
- Generating PRs, branches, or commits,
- Rewriting `.beztack/origin.json` as a side effect of an inspection,
- Treating any generic CLI tag as a Template revision,
- Writing an ADR for the pivot before the prototype has produced
  evidence.

When the harness and this workflow accumulate enough evidence to
justify those next steps, file a narrow follow-up issue. Do not
bundle follow-up work into issue #36.
