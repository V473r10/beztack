# Real Beztack validation

Part of the [build-vs-adopt spike](../README.md). Exercises the custom
engine prototype against the real current `beztack.template.json`
strategy (copied verbatim) and a synthetic lncd-like Derived project.

The real `lncd` repository is not accessible from this spike
environment; the synthetic Derived project substitutes for it. See
[`analysis.md`](analysis.md) for what this validation does and does not
prove, and what is missing.

## Layout

```text
real-validation/
├── README.md
├── analysis.md                              # spike findings
├── status.out.json                          # engine output
├── apply-plan.out.json                      # engine output
├── promotion-metadata.out.json              # engine output
├── beztack.template.json                    # real Beztack strategy
├── template-revisions/
│   ├── v1.0.0/
│   │   └── beztack.template.json            # real Beztack strategy (Origin)
│   └── v1.1.0/
│       ├── beztack.template.json            # real Beztack strategy (candidate)
│       ├── .env.contract.json               # new in v1.1.0
│       └── package.json                     # new in v1.1.0
├── derived-project/
│   ├── .beztack/
│   │   ├── template.json                    # Sync policy
│   │   ├── parameters.json                  # Template parameters
│   │   └── origin.json                      # Origin baseline
│   ├── beztack.template.json                # lncd-local strategy
│   ├── apps/api/db.ts                       # Custom-owned (Product domain)
│   ├── apps/api/routes.ts                   # Custom-owned (Product domain)
│   ├── packages/cli/index.ts                # Template-owned (Promotion candidate)
│   └── .env.example                         # Custom-owned (Product env)
└── schemas/                                 # shared with the fixture
    ├── apply-plan.schema.json
    ├── origin-baseline.schema.json
    ├── promotion-metadata.schema.json
    ├── sync-policy.schema.json
    └── sync-state.schema.json
```

## Reproduction

```bash
# From the repo root:
node docs/template-sync-spike/custom-engine/beztack-sync.mjs \
  status --fixture docs/template-sync-spike/real-validation \
  --from v1.0.0 --to v1.1.0
node docs/template-sync-spike/custom-engine/beztack-sync.mjs \
  apply --plan --fixture docs/template-sync-spike/real-validation \
  --from v1.0.0 --to v1.1.0
node docs/template-sync-spike/custom-engine/beztack-sync.mjs \
  promotion-metadata --fixture docs/template-sync-spike/real-validation \
  --from v1.0.0 --to v1.1.0
```

Each output is also captured as a `.out.json` file in this directory
for review.
