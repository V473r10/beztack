# Promotion labels

Promotion from a Derived project back to the Template source is opt-in. The
fixture uses the Promotion label convention `promotion: candidate` so a
Derived project's PR is considered for Promotion only when the author
explicitly opts in.

## Convention

- PR label: `promotion: candidate`.
- Engine reads the label and the PR diff, then produces Promotion metadata.
- Promotion candidates are filtered by Sync policy ownership.
- Custom-owned Product domain files are excluded by default.
- Overlapping Promotions are linked, not auto-deduplicated.

## Fixture scenario

The Derived project opened a PR labelled `promotion: candidate` that adds:

- `packages/util/retry.ts` (new) — Template-owned via `packages/**`.
- `packages/util/package.json` (new) — Template-owned via `packages/**`.

These two files should appear as Promotion candidates.

The Derived project also has Product-domain work in `apps/checkout/**`
that MUST appear as skipped (Custom-owned) in the Promotion metadata.
