## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues for `V473r10/beztack` via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The repo uses the canonical triage label vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: use root `CONTEXT.md` and root `docs/adr/` when present. See `docs/agents/domain.md`.

## Module shape (opt-in)

Behaviour that several call sites share, and that has two real implementations, can live behind a module interface under `apps/api/server/domain/<name>/` instead of another flat file in `apps/api/server/utils/`. `apps/api/server/domain/organization-access/` is the reference implementation:

- `contract.ts`: the interface, its types and its errors. Doc comments carry the decisions the module enforces.
- `index.ts`: `export * from "./contract"` plus the one production instance. Callers import the directory, never a file inside it.
- `implementation.ts`: the factory. It takes one dependencies object whose fields are all optional and fail closed when omitted, and returns the contract type. Pure rules that callers must reach without loading the production adapter may be exported from here too.
- `internal/`: anything else. Nothing outside the module directory imports from `internal/` (enforced by `no-restricted-imports` in `vite.config.ts`); a caller that needs to is telling you the contract is missing a method.
- `production.ts` and `testing.ts`: the adapters at that one seam. Production wires the real database and env; testing is a hand-written in-memory world. Add a `test-database.ts` only where behaviour depends on real SQL semantics.

Tests import `./testing` or `./implementation` directly, because `index.ts` loads the production adapter (`@beztack/db`, `@/env`). Drive the module through the same interface callers use; a test that must reach past the contract to arrange its setup is evidence the contract is wrong.

**When not to use it.** Two adapters make a real seam; one makes a hypothetical one. A single exported function with one optional dependency defaulted to production is the more common right answer, and the full `contract`/`implementation`/`internal` scaffold around it is ceremony. Packages (`packages/*`) keep their package boundary as the seam and do not follow this shape. Domain language belongs in `CONTEXT.md`, which stays a glossary with no code shape.
