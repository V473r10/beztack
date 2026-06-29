# Promotion labels (issue #33)

Promotion from a Derived project back into the Template source is
opt-in. The PR label on the Derived project is the authoritative
opt-in signal — engines must refuse to emit Promotion metadata
without one. The fixture uses the convention `promotion: candidate`.

## Convention

- **PR label:** `promotion: candidate` (the canonical Promotion label;
  engines accept any non-empty label supplied via `--label`).
- **Source PR / issue links:** engines record every PR or issue
  reference via `--source-pr URL` (repeatable). The first link is
  mirrored in `sourcePR`; the full list lives in `sourcePRs[]`.
- **Entry mode:** engines record how the source PR entered Beztack
  via `entryMode`. Trusted Derived projects may use
  `--trusted-automation` (`entryMode: "trusted-automation"`);
  Community Derived projects may use `--community-entry-mode patch`
  (`entryMode: "patch"`). The default is `entryMode: "normal-pr"`.
  Beztack review is required in every case (ADR-0006).
- **Upstream CI checks:** engines record source-PR CI checks supplied
  via `--check NAME=RESULT` (repeatable) with
  `source: "upstream-pr-ci"`. Engine-internal validation checks are
  tagged `source: "engine"`.
- **Related overlapping Promotions:** engines link other open Promotions
  that touch overlapping paths via
  `--related-promotion DERIVED_PROJECT_ID,LABEL` (repeatable).
  Overlapping Promotions are linked for reviewer awareness rather than
  auto-deduplicated.
- **Promotion candidates** are filtered by Sync policy ownership:
  Template-owned paths become candidates; Custom-owned Product-domain
  files are skipped; Mixed-with-seam paths are skipped
  (`mixed-protected-by-seam`); Mixed-without-seam paths are surfaced
  for **Platform extraction** (`platform-extraction-required`)
  rather than direct Promotion.

## Fixture scenario

The Derived project opened a PR labelled `promotion: candidate` that adds:

- `packages/util/retry.ts` (new) — Template-owned via `packages/**`.
- `packages/util/package.json` (new) — Template-owned via `packages/**`.

These two files appear as Promotion candidates.

The Derived project also has Product-domain work in `apps/checkout/**`
that appears as skipped (Custom-owned, `custom-owned-product-domain`)
in the Promotion metadata, so the reviewer can confirm Product-domain
code did not flow into Beztack.
