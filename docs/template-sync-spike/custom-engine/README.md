# Custom engine prototype

> Part of the [build-vs-adopt spike](../README.md). Implements the
> engine-agnostic fixture contract from
> [`../../template-sync-fixture/`](../../template-sync-fixture/) in a
> small Node-based CLI.

## What this is

A throwaway prototype whose only purpose is to demonstrate that the
Template sync engine contract can be implemented against the fixture,
and that the implementation produces schema-versioned JSON outputs that
satisfy the contract. It is intentionally minimal:

- Reads the fixture (no real Git, no real GitHub API).
- Emits three outputs: `status`, `apply --plan`, `promotion-metadata`.
- Validates each output against the fixture's JSON Schemas
  (`schemas/sync-state.schema.json`, `schemas/apply-plan.schema.json`,
  `schemas/promotion-metadata.schema.json`).
- Does not create branches, PRs, or commits. PR creation is a
  follow-up concern; the engine emits a `branch` field in the apply
  plan and stops there.
- Does not load environment variables, look up the Trusted Derived
  project registry, or perform any side effects. Those are follow-up
  issues.

## Usage

```bash
# From the repo root:
node docs/template-sync-spike/custom-engine/beztack-sync.mjs \
  status --fixture docs/template-sync-fixture
node docs/template-sync-spike/custom-engine/beztack-sync.mjs \
  apply --plan --fixture docs/template-sync-fixture
node docs/template-sync-spike/custom-engine/beztack-sync.mjs \
  promotion-metadata --fixture docs/template-sync-fixture

# Compare to fixture expected/*.json (validates schemas and key semantics):
node docs/template-sync-spike/custom-engine/compare.mjs \
  docs/template-sync-fixture
```

The compare script writes a JSON report and exits 0 only if every
schema validates and every key semantic invariant holds. The current
implementation passes all checks against the engine-agnostic fixture.

## Options

- `--fixture PATH` — fixture root (default: `docs/template-sync-fixture`).
- `--from REV` — Origin revision (default: `v1.1.0`).
- `--to REV` — candidate revision (default: `v1.2.0`).
- `--derived-project PATH` — Derived project root (default:
  `<fixture>/derived-project`).
- `--engine NAME VERSION` — overrides `syncEngine.name` /
  `syncEngine.version` in outputs.

## Layout

```text
custom-engine/
├── README.md
├── package.json
├── beztack-sync.mjs       # engine entry point
└── compare.mjs            # fixture-vs-engine comparator
```

The comparator (`compare.mjs`) embeds a minimal JSON Schema validator
sufficient for the spike (enum + required + `additionalProperties: false`).
For the production engine, use `ajv` or another battle-tested validator.

## Why this is small

The spike recommendation is to **build custom**, but the spike itself
does not need a production-quality engine. The prototype is enough to:

1. Show that the contract is implementable.
2. Validate the schemas against realistic outputs.
3. Provide a reference for the follow-up implementation issue.

The follow-up implementation issue should:

- Replace the inline JSON Schema validator with `ajv` (or similar).
- Add PR creation via the GitHub API or the `gh` CLI.
- Add the Trusted Derived project registry lookup.
- Add env loading and parameter rendering in `apply`.
- Add promotion-metadata generation from a real PR (using the `gh` API
  or webhook input).
- Add a CI workflow that runs `compare.mjs` against the fixture on
  every PR.
