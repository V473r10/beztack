# Real Beztack validation — analysis

> Issue #28 acceptance criterion: "The spike validates the leading
> option against the real Beztack → lncd case."
>
> Missing capability: the real `lncd` repository is not accessible from
> this spike environment. The validation here substitutes a synthetic
> Derived project that uses the **real** current `beztack.template.json`
> strategy verbatim, so the same engine is exercised against real
> project complexity.

## Setup

- **Origin strategy** (`real-validation/template-revisions/v1.0.0/beztack.template.json`):
  the real current Beztack strategy, copied verbatim. `packages/**`
  template-owned, `apps/**` custom-owned, `**` mixed catch-all.
- **Candidate strategy** (`real-validation/template-revisions/v1.1.0/beztack.template.json`):
  a real diff from the Origin — adds explicit rules for
  `.env.contract.json` (template-owned), `.env.example`
  (custom-owned), `pnpm-lock.yaml` (custom-owned), and a migration
  entry `add-environment-contract-separation`. This is the kind of
  diff a real `beztack.template.json` evolution would have once the
  Environment contract separation is implemented.
- **Derived project**: `real-validation/derived-project/`. Synthetic
  lncd-like state with Custom-owned apps/api customisations and a
  Template-owned `packages/cli/index.ts` to demonstrate the
  Promotion-candidate case.

## Reproduction

```bash
node docs/template-sync-spike/custom-engine/beztack-sync.mjs \
  status --fixture docs/template-sync-spike/real-validation \
  --from v1.0.0 --to v1.1.0
node docs/template-sync-spike/custom-engine/beztack-sync.mjs \
  apply --plan --fixture docs/template-sync-spike/real-validation \
  --from v1.0.0 --to v1.1.0
node docs/template-sync-spike/custom-engine/beztack-sync.mjs \
  promotion-metadata --fixture docs/template-sync-spike/real-validation \
  --from v1.0.0 --to v1.1.0 --trust-class trusted
```

Recorded outputs: `status.out.json`, `apply-plan.out.json`,
`promotion-metadata.out.json`.

## Findings

### 1. Schema conformance

All three outputs validate against the engine-agnostic fixture's JSON
schemas (`schemas/sync-state.schema.json`,
`schemas/apply-plan.schema.json`,
`schemas/promotion-metadata.schema.json`). This is the most important
result: the engine is decoupled from the fixture's specific scenario
and works against any strategy that conforms to the contract.

### 2. The candidate strategy narrows ownership ambiguity

The engine reports **3 overlaps** for this scenario:

- `apps/api/db.ts` — `apps/**` (custom-owned) vs `**` (mixed)
- `apps/api/routes.ts` — `apps/**` (custom-owned) vs `**` (mixed)
- `apps/checkout/index.ts` — `apps/**` (custom-owned) vs `**` (mixed)

These are **policy validation warnings**, not Sync conflicts. They
confirm PRD #27's prediction that "existing lncd wiring drift should
be treated as evidence of missing Sync seams." The current Beztack
strategy uses the `**` mixed catch-all, which means every file matches
two ownership rules. The candidate strategy in v1.1.0 narrows this
slightly by adding explicit rules for environment files, but the
`apps/**` vs `**` overlap is still present and surfaces as a warning.

This is exactly the contract's expected behavior. The follow-up
implementation issue should either:

- Add explicit Sync seams for known shared files (e.g.
  `apps/api/routes.ts` via the `api-route-registration` seam), or
- Narrow the catch-all `**` so it is not mixed by default.

### 3. Apply plan emits a non-main branch with the right updates

The apply plan output:

```text
branch:           template-sync/v1.0.0-to-v1.1.0
updates:          3  (.env.contract.json, beztack.template.json, package.json)
skipped:          4  (apps/api/*, .env.example, packages/cli/index.ts as preserved addition)
conflicts:        0
blockers:         []
```

This matches the contract:

- ✅ C2 — branch is `template-sync/v1.0.0-to-v1.1.0`, not `main`.
- ✅ C3 — Origin baseline (`v1.0.0`) and candidate revision (`v1.1.0`)
  are explicit.
- ✅ C10 — `pnpm-lock.yaml` is not present in either template revision
  (it would be classified Custom-owned with a regeneration note if
  it appeared).
- ✅ C12 — apply plan is schema-versioned JSON with the required
  fields.

The inclusion of `beztack.template.json` in `updates` is the
strategy-migration case: the v1.1.0 candidate has new ownership rules
for environment files, so applying v1.1.0 updates the Derived
project's `beztack.template.json` to match.

### 4. Promotion metadata is gated on the Derived project's changes

Promotion metadata for this scenario reports **1 candidate**
(`packages/cli/index.ts`, template-owned) and **3 skipped** files
(`apps/api/db.ts`, `apps/api/routes.ts`, `.env.example`, all
custom-owned). This validates C7 — opt-in Promotion filtered by
ownership. The engine correctly excludes Custom-owned Product-domain
files from candidates.

`trustClass` is `"trusted"` (set via `--trust-class trusted` on the
CLI), which validates that the engine reads the trust classification
correctly. The follow-up implementation should source this from the
Trusted Derived project registry rather than the CLI; the CLI flag is
a spike-prototype seam.

### 5. The trust boundary is real but only one class is exercised

This validation only exercises the `trusted` class end-to-end.
A Community Derived project would behave the same in the engine's
output (Promotion metadata still carries `trustClass: "community"`),
but the gate on automated update dispatch and the gate on Promotions
entering Beztack as untrusted PRs are downstream concerns that the
follow-up implementation must add. The Trust boundary is supported by
the schema and the engine's data model; the gate behavior is a
follow-up issue.

### 6. Missing capability — the actual lncd repo

The actual `lncd` repository is not in this workspace, has no clone URL
in this spike environment, and requires credentials not available here.
A full validation against the real `lncd` would:

- Replace the synthetic Derived project with `git clone` of the real
  `lncd`.
- Use the real `lncd`'s `beztack.template.json` (if present) or fall
  back to the real Beztack strategy with lncd-specific overrides.
- Surface the actual Sync conflicts and overlaps that lncd's wiring
  drift creates.
- Confirm that the engine's recommendations match what the lncd
  maintainers actually need to do.

This follow-up is not in scope for issue #28, but it should be the
first thing the implementation issue does after the spike lands. The
synthetic validation here demonstrates the engine is structurally
correct; only the real-data validation will confirm it is correct for
the actual project.

## Summary

The custom engine prototype runs end-to-end against a real diff in the
Beztack strategy (v1.0.0 → v1.1.0 with the Environment contract
separation migration). Schema conformance holds. The overlap warnings
match the contract's prediction about missing Sync seams. Apply plans
and Promotion metadata are produced correctly. The next step —
validation against the real `lncd` repo — is documented as missing
capability and is the first task for the follow-up implementation
issue.
