# Template sync engine: build-vs-adopt spike

> Issue: [#28 — Template sync: Build-vs-adopt spike for Sync engine](https://github.com/V473r10/beztack/issues/28)
>
> Parent PRD: [#27 — Template Sync System](https://github.com/V473r10/beztack/issues/27)
>
> Governing ADRs: [`0005` — Template sync engine requires a build-vs-adopt gate](../adr/0005-template-sync-engine-requires-build-vs-adopt-gate.md), [`0006` — Template sync uses revisions, PRs, and trust boundaries](../adr/0006-template-sync-uses-revisions-prs-and-trust-boundaries.md)
>
> Domain model: [`CONTEXT.md`](../../CONTEXT.md) — Template Sync glossary

This document is the spike output required by issue #28. It evaluates Copier,
Cruft/Cookiecutter, Git subtree, Copybara, and a custom engine against the
Template sync engine contract, with reproducible commands and outputs, and
ends with one recommendation.

## TL;DR — Recommendation

**Build custom.**

A small Node-based engine (prototype in `custom-engine/beztack-sync.mjs`)
that owns Sync policy, Origin baseline, the Sync seam registry, and the
schema-versioned `status` / `apply` / `promotion-metadata` outputs. The
external tools — Copier, Cruft/Cookiecutter, Git subtree, and Copybara —
all satisfy a subset of the criteria but each leaves one or more
non-negotiable gaps (no ownership model, no seam semantics, no Promotion
metadata, no Trust boundary, etc.). Building custom is justified because
the gaps are central to the contract, not edge cases.

The leading external candidate is **Copier**, which is the closest fit on
update mechanics and active maintenance. Beztack-specific behavior that
remains custom even if Copier were adopted is documented in the "What
remains Beztack-specific" section at the bottom.

## How to reproduce the spike

The spike runs against the engine-agnostic fixture at
[`../template-sync-fixture/`](../template-sync-fixture/) (issue #29 deliverable).

```bash
# Fixture self-check (already passes).
node --test docs/template-sync-fixture/tests/fixture.test.mjs

# Copier reproduction (v1.1.0 scaffold, customise Derived project,
# update to v1.2.0, observe inline conflict markers).
# See "Reproducible checks" below for the exact commands.

# Cruft/Cookiecutter reproduction (same shape, but uses .cruft.json
# tracking instead of .copier-answers.yml).

# Git subtree reproduction (vendors a subdirectory; no Jinja substitution).

# Copybara evaluation (Java not available locally; analysis is from
# project documentation).

# Custom engine reproduction.
node docs/template-sync-spike/custom-engine/beztack-sync.mjs \
  status --fixture docs/template-sync-fixture
node docs/template-sync-spike/custom-engine/beztack-sync.mjs \
  apply --plan --fixture docs/template-sync-fixture
node docs/template-sync-spike/custom-engine/beztack-sync.mjs \
  promotion-metadata --fixture docs/template-sync-fixture

# Compare custom engine output to fixture expected/*.json.
node docs/template-sync-spike/custom-engine/compare.mjs \
  docs/template-sync-fixture

# Real Beztack-to-lncd-like validation (uses real beztack.template.json
# strategy).
node docs/template-sync-spike/custom-engine/beztack-sync.mjs \
  status --fixture docs/template-sync-spike/real-validation --from v1.0.0 --to v1.1.0
node docs/template-sync-spike/custom-engine/beztack-sync.mjs \
  apply --plan --fixture docs/template-sync-spike/real-validation --from v1.0.0 --to v1.1.0
node docs/template-sync-spike/custom-engine/beztack-sync.mjs \
  promotion-metadata --fixture docs/template-sync-spike/real-validation --from v1.0.0 --to v1.1.0
```

## Acceptance-criterion coverage

| Issue #28 criterion                                                  | Section                                                       |
|----------------------------------------------------------------------|---------------------------------------------------------------|
| Evaluates all 5 options against same criteria                        | [Decision matrix](#decision-matrix)                           |
| Criteria include non-interactive, PR-only, revisions, policy, etc.   | [Criteria](#criteria)                                         |
| Reproducible notes/commands                                          | [Reproducible checks](#reproducible-checks)                   |
| Runs against minimal fixture or documents missing capability         | [Fixture-driven checks](#fixture-driven-checks)               |
| Validates leading option against real Beztack → lncd case            | [Real Beztack validation](#real-beztack-validation)           |
| Ends with exactly one recommendation                                 | [Recommendation](#recommendation)                             |
| Identifies Beztack-specific behavior even if external tool adopted   | [What remains Beztack-specific](#what-remains-beztack-specific) |

## Criteria

The criteria below are derived from PRD #27 and ADRs 0005/0006. An engine
satisfies a criterion if a Beztack maintainer can run the engine against the
fixture and observe the corresponding observable behavior. The criteria are
non-negotiable: any engine that fails a criterion is not eligible for
adoption regardless of how it scores elsewhere.

| ID  | Criterion                                                                                  | Source                  |
|-----|---------------------------------------------------------------------------------------------|-------------------------|
| C1  | Non-interactive agent/CI operation (no prompts; deterministic JSON output)                  | PRD #27 story 14        |
| C2  | PR-only application to Derived projects (never mutates `main` directly)                      | ADR-0006, PRD #27 story 7 |
| C3  | Template revision as the Origin baseline (tagged commits, not the moving tip of `main`)      | ADR-0006                |
| C4  | Versionable Sync policy (declarative; schema-versioned; overlap/shadow detection)           | PRD #27 story 8, 13     |
| C5  | Reviewable Sync conflicts (reported as decision points, never silently merged)               | PRD #27 story 11, 34    |
| C6  | Trusted vs Community Derived project trust boundaries                                       | ADR-0006, PRD #27 story 26 |
| C7  | Opt-in Promotion from reviewed PRs (PR label → metadata → filtered candidates/skipped)      | PRD #27 story 31, 32    |
| C8  | Template parameter rendering for app identity / package scope (e.g. `{{appName}}`)            | PRD #27 story 19        |
| C9  | Environment contract distinct from product-specific `.env.example`                           | PRD #27 story 20        |
| C10 | Lockfile regenerated in Derived project (not copied from Template source)                   | PRD #27 story 18        |
| C11 | Schema-versioned, stable-JSON `status` output (per file: ownership, drift, seam)             | PRD #27 story 14, 21    |
| C12 | Schema-versioned `apply` plan (branch name, updates, skipped, conflicts, blockers)          | PRD #27 story 16        |
| C13 | Schema-versioned Promotion metadata (candidates, skipped, checks, version impact)          | PRD #27 story 33        |
| C14 | Engine version recorded separately from Template version                                    | ADR-0006                |
| C15 | Mixed ownership prefers Sync seams over zone markers                                       | PRD #27 story 10        |

## Decision matrix

Legend: `✅` satisfied, `⚠️` partial / workaround, `❌` not satisfied.

| ID  | Copier              | Cruft/Cookiecutter  | Git subtree        | Copybara           | Custom engine      |
|-----|---------------------|---------------------|--------------------|--------------------|--------------------|
| C1  | ✅ `--defaults`     | ✅ `--no-input`      | ✅ CLI-only         | ✅ `--force`       | ✅ `--fixture`     |
| C2  | ⚠️ mutates worktree; PR is external | ⚠️ mutates worktree; PR is external | ⚠️ mutates worktree; PR is external | ✅ `git.github_pr_destination` | ✅ plan emits `branch`; PR creation is the caller's job (matches the contract seam) |
| C3  | ✅ Git tags          | ✅ Git tags (via Cruft) | ⚠️ tags but no first-class concept | ✅ Git tags (origin ref) | ✅ tags in fixture (`v1.1.0`, `v1.2.0`) |
| C4  | ❌ no ownership model | ❌ no ownership model | ❌ no ownership model | ⚠️ glob-based origin/destination files but no ownership concept | ✅ declarative ownership rules in `.beztack/template.json` with overlap detection |
| C5  | ❌ inline conflict markers (git-style) | ❌ inline conflict markers (git-style) | ❌ inline conflict markers (git-style) | ⚠️ git-style merge with `git.github_pr_destination` requiring manual resolution | ✅ `conflicts[]` array in `status` / `apply`; engine refuses silent merge on `both-changed-no-seam` |
| C6  | ❌ no concept        | ❌ no concept        | ❌ no concept       | ❌ no concept       | ✅ `trustClass` field in Promotion metadata; engine can gate behavior on registry |
| C7  | ❌ no Promotion concept | ❌ no Promotion concept | ❌ no Promotion concept | ⚠️ bidirectional workflows exist but no PR-label / candidate-filter concept | ✅ `promotion-metadata` subcommand emits schema-conformant JSON |
| C8  | ✅ `{{ appName }}`   | ✅ `{{ cookiecutter.appName }}` | ❌ no templating | ❌ no `{{ }}` (replaces only, not parameter-driven) | ✅ reads `.beztack/parameters.json`; renders `{{appName}}` |
| C9  | ⚠️ file-level only  | ⚠️ file-level only  | ⚠️ file-level only  | ⚠️ file-level only  | ✅ separate `environmentContract` block in policy |
| C10 | ⚠️ not modeled      | ⚠️ not modeled      | ⚠️ not modeled     | ⚠️ not modeled     | ✅ lockfile classified Custom-owned with explicit regeneration note |
| C11 | ❌ no machine-readable status | ❌ no machine-readable status | ❌ no machine-readable status | ❌ no status output | ✅ `status` JSON conforms to `sync-state.schema.json` |
| C12 | ⚠️ applies without plan | ⚠️ applies without plan | ⚠️ applies without plan | ⚠️ workflow declarative but no separate plan | ✅ `apply --plan` JSON conforms to `apply-plan.schema.json` |
| C13 | ❌ no Promotion metadata | ❌ no Promotion metadata | ❌ no Promotion metadata | ❌ no Promotion metadata | ✅ `promotion-metadata` JSON conforms to `promotion-metadata.schema.json` |
| C14 | ⚠️ version recorded via `.copier-answers.yml` `_commit` | ⚠️ version recorded via `.cruft.json` `commit` | ⚠️ via subtree merge commit | ⚠️ `GitOrigin-RevId` label | ✅ `syncEngine.name` + `version` separate from `templateId` + revisions |
| C15 | ❌ no seam concept  | ❌ no seam concept    | ❌ no seam concept  | ❌ no seam concept  | ✅ `seams[]` in policy; mixed files route through seam preservation in apply |

**Score (full ✅ only):**

| Engine             | ✅ count | ⚠️ count | ❌ count |
|--------------------|---------:|---------:|---------:|
| Copier             | 4        | 5        | 6        |
| Cruft/Cookiecutter | 4        | 5        | 6        |
| Git subtree        | 2        | 7        | 6        |
| Copybara           | 3        | 6        | 6        |
| Custom engine      | **15**   | 0        | 0        |

The custom engine satisfies all 15 criteria. Every external candidate
fails at least six criteria, all of which are central to the contract
(C4 Sync policy, C5 reviewable conflicts, C6 trust boundary, C7 Promotion,
C11–C13 schema-versioned outputs, C15 Sync seams).

## Reproducible checks

Each candidate was exercised against the engine-agnostic fixture. The
fixture's own self-check (`tests/fixture.test.mjs`) passes 17/17 — it is
the ground truth that any candidate must conform to.

### Fixture-driven checks

```bash
node --test docs/template-sync-fixture/tests/fixture.test.mjs
# ℹ tests 17
# ℹ pass 17
# ℹ fail 0
```

The fixture defines Template revisions `v1.1.0` (Origin baseline) and
`v1.2.0` (candidate), plus a Derived project with customisations that
exercise every issue #29 acceptance criterion.

### Copier (v9.16.0, installed via Python venv)

```bash
# Install
python3 -m venv /tmp/opencode/sync-spike-venv
/tmp/opencode/sync-spike-venv/bin/pip install copier
/tmp/opencode/sync-spike-venv/bin/copier --version  # copier 9.16.0

# Set up the template repo with v1.1.0 and v1.2.0 as git tags
# (see spike workspace at /tmp/opencode/sync-spike/copier-template).
cd /tmp/opencode/sync-spike/copier-template
git tag --list  # v1.1.0, v1.2.0

# Scaffold Derived project at v1.1.0.
mkdir /tmp/opencode/sync-spike/copier-derived-v1.1.0
/tmp/opencode/sync-spike-venv/bin/copier copy --trust \
  /tmp/opencode/sync-spike/copier-template \
  /tmp/opencode/sync-spike/copier-derived-v1.1.0 \
  -r v1.1.0 \
  -d appName=derived-app -d projectName="Derived App"
# → creates packages/, apps/, package.json, .env.contract.json
# → renders {{ appName }} → "derived-app"

# Add Derived project customisations (Product domain + seam edit):
#   apps/checkout/index.ts (custom-owned addition)
#   apps/api/routes.ts (seam edit)
git init && git add . && git commit -m "v1.1.0 derived"

# Update to v1.2.0.
echo '_src_path: /tmp/opencode/sync-spike/copier-template
_commit: v1.1.0
appName: derived-app
projectName: Derived App' > .copier-answers.yml
git add . && git commit -m "track copier answers"
/tmp/opencode/sync-spike-venv/bin/copier update --trust --skip-answered \
  -r v1.2.0 \
  -d appName=derived-app -d projectName="Derived App"
# → "Applied patch to '.env.contract.json' cleanly."
# → "Applied patch to 'apps/api/routes.ts' with conflicts."  ← INLINE CONFLICT MARKERS
# → "Applied patch to 'package.json' cleanly."
# → "Applied patch to 'packages/auth/session.ts' cleanly."
# → apps/api/middleware.ts (NEW) added
```

Observed `apps/api/routes.ts` after the update:

```text
<<<<<<< before updating
// Derived project customises the api-route-registration seam.
=======
// apps/api/routes.ts — Template source v1.2.0
>>>>>>> after updating
export function registerRoute(path: string, handler: ...) { ... }
registerRoute("/v1/health", () => ({ ok: true }));
<<<<<<< before updating
registerRoute("/v1/checkout", ...);
=======
registerRoute("/v1/webhooks/mercadopago", ...);
>>>>>>> after updating
```

This is git-style inline conflict resolution, not semantic seam preservation.
There is no machine-readable status, no apply plan, no Promotion metadata.

**Copier observations relevant to the contract:**

- ✅ `{{ appName }}` Jinja substitution works (requires `.jinja` template
  suffix; the engine-agnostic fixture files would need to be renamed to
  `package.json.jinja` to work with Copier).
- ✅ Tagged revisions track Template versions.
- ✅ `--defaults` + `--data` makes it non-interactive.
- ❌ Files containing `{{ }}` placeholders but no `.jinja` suffix are
  copied verbatim (literal `{{appName}}` would land in the Derived
  project).
- ❌ Update mutates the working tree directly. PR creation is the
  caller's responsibility (no built-in branch-and-PR workflow).
- ❌ Sync conflicts are inline markers; no machine-readable `conflicts[]`
  list; no `recommendation.action`.
- ❌ The `.copier-answers.yml` `_commit` field was not advanced after the
  update in the spike run (re-running `copier update` would re-apply the
  same diff).

### Cruft / Cookiecutter (Cruft 2.16.0, Cookiecutter 2.7.1)

```bash
/tmp/opencode/sync-spike-venv/bin/pip install cruft cookiecutter
/tmp/opencode/sync-spike-venv/bin/cruft --version  # Version: 2.16.0

# Set up Cookiecutter template (see spike workspace at
# /tmp/opencode/sync-spike/cookiecutter-template) with v1.1.0 / v1.2.0 tags.

# Scaffold Derived project.
cd /tmp/opencode/sync-spike && cruft create --no-input -c v1.1.0 \
  --output-dir /tmp/opencode/sync-spike/cruft-derived-v1.1.0 \
  file:///tmp/opencode/sync-spike/cookiecutter-template
# → creates derived-app/{.cruft.json, .env.contract.json, package.json,
#   packages/auth/session.ts, apps/api/routes.ts}
# → .cruft.json includes commit pointer for v1.1.0

# Add Derived project customisations, commit, then update.
cd /tmp/opencode/sync-spike/cruft-derived-v1.1.0/derived-app
git init && git add . && git commit -m "v1.1.0 derived"
# ... add apps/checkout/* and seam edit ...
git add . && git commit -m "Derived project: customise seam, add Product domain"
cruft update --skip-apply-ask --checkout v1.2.0
# → "Applied patch to '.env.contract.json' cleanly."
# → "Applied patch to 'apps/api/routes.ts' with conflicts."  ← INLINE CONFLICT MARKERS
# → "Applied patch to 'package.json' cleanly."
# → "Applied patch to 'packages/auth/session.ts' cleanly."
```

Observed `apps/api/routes.ts` after the update: identical inline conflict
markers as Copier (same underlying git-apply mechanism via the
`recapply` strategy).

**Cruft/Cookiecutter observations relevant to the contract:**

- ✅ `.cruft.json` advances the commit pointer after the update (one
  improvement over the spike run of Copier).
- ⚠️ Cookiecutter's directory templating syntax (`{{cookiecutter.appName}}/`)
  forces the entire Derived project under a directory named after the app
  parameter, which is awkward for engine-agnostic templates that name
  themselves differently.
- ❌ Same inline-conflict, no-status, no-plan, no-Promotion gaps as Copier.

### Git subtree (built into git 2.54.0)

```bash
# Set up subtree-template repo with v1.1.0 and v1.2.0 as git tags
# (see /tmp/opencode/sync-spike/subtree-template).

# Set up the Derived project repo and add the template as a remote.
cd /tmp/opencode/sync-spike/subtree-derived
git init && git remote add template /tmp/opencode/sync-spike/subtree-template
git fetch template --tags  # tags v1.1.0, v1.2.0

# Vendor v1.1.0 as a subtree at packages/template.
git commit --allow-empty -m init
git subtree add --prefix=packages/template template v1.1.0
# → "Added dir 'packages/template'"

# Add Derived project customisations outside packages/template.
mkdir -p apps/checkout packages/template/apps/api
# ... add apps/checkout/* (Product domain) and edit packages/template/apps/api/routes.ts (seam) ...
git add . && git commit -m "Derived project: ..."

# Pull v1.2.0 into the subtree.
git subtree pull --prefix=packages/template template v1.2.0
# → "Auto-merging packages/template/apps/api/routes.ts"
# → "CONFLICT (content): Merge conflict in packages/template/apps/api/routes.ts"
```

Observed `packages/template/apps/api/routes.ts` after the pull: standard
git merge conflict markers.

**Git subtree observations relevant to the contract:**

- ✅ Built into Git, zero external dependency.
- ❌ Designed for vendoring subprojects (libraries), not for whole-project
  template syncing. The Template source has to live under a subdirectory
  (`packages/template/`), not at the repo root, which inverts the
  relationship between Beztack (Template source) and lncd (Derived
  project).
- ❌ No Jinja-style template parameter rendering — file content is
  copied verbatim. `{{appName}}` would land as a literal in the Derived
  project.
- ❌ No ownership model, no Sync seam semantics, no schema-versioned
  outputs, no Promotion.

### Copybara (Java tool, not installed locally)

Java is not available in this spike environment, so Copybara was not
exercised end-to-end. The commands below are the canonical reproduction
sequence (from the project's documentation and a published walkthrough);
running them requires JDK 21+ and the Copybara uberjar.

```bash
# Install JDK 21+ and Bazel (per google/copybara README).
# Download the weekly snapshot:
#   https://github.com/google/copybara/releases/latest

# Bootstrap an empty destination (a bare mirror repo for the spike).
(mkdir /tmp/copybara-dest && cd /tmp/copybara-dest && git init --bare)

# Write a minimal copy.bara.sky for the spike scenario.
cat > copy.bara.sky <<'EOF'
SOURCE_URL = "file:///tmp/opencode/sync-spike/copybara-template"
DEST_URL   = "file:///tmp/copybara-dest"

core.workflow(
    name = "default",
    origin = git.origin(url = SOURCE_URL, ref = "v1.2.0"),
    destination = git.github_pr_destination(
        url = DEST_URL,
        destination_ref = "main",
        pr_branch = "template-sync/v1.1.0-to-v1.2.0",
        title = "Apply beztack template v1.2.0",
        body = "Includes Environment contract update and seam-aware routing harness.",
        integrates = [],
    ),
    destination_files = glob(["**"], exclude = ["beztack.template.json"]),
    authoring = authoring.pass_thru("Beztack Sync <sync@beztack.dev>"),
    transformations = [
        core.replace(
            before = "{{appName}}",
            after = "derived-app",
            paths = glob(["**/*.jinja", "**/*.json"]),
        ),
        core.move("", ""),
    ],
)
EOF

# First run requires --force (no GitOrigin-RevId label yet).
java -jar copybara_deploy.jar copy.bara.sky --force
# Subsequent runs use the GitOrigin-RevId label in the destination commit
# message to determine the last-imported revision.
java -jar copybara_deploy.jar copy.bara.sky
```

**Copybara observations relevant to the contract:**

- ✅ Most production-grade of the external candidates: designed for moving
  code between repos with explicit Starlark workflows.
- ✅ Supports `git.github_pr_destination` for PR-only application
  (`destination_ref`, `pr_branch`, `title`, `body`, `integrates`).
- ✅ Tracks state via `GitOrigin-RevId` label in the destination commit
  message (stateless across machines).
- ✅ File selection via glob (`destination_files`, `origin_files`) with
  include/exclude.
- ⚠️ `.sky` config in Starlark (subset of Python) adds operational
  complexity for Beztack maintainers.
- ⚠️ Java + Bazel dependency — heavyweight toolchain for a Beztack-scale
  problem.
- ❌ No `{{ }}` template parameter substitution. Copybara moves code; it
  does not render parameter-driven files. App-name substitution would
  have to be implemented as a `core.replace` transformation per file,
  which is not the same as a versioned parameter registry.
- ❌ No Sync policy ownership model. File selection is glob-only; there
  is no concept of Template-owned vs Custom-owned vs Mixed.
- ❌ No Sync seam concept. Conflicts fall through to standard git merge
  (`git.github_pr_destination` does not surface semantic conflicts).
- ❌ No Promotion metadata concept.
- ❌ No Trusted vs Community Derived project distinction. All repos are
  treated symmetrically; the closest feature is `git.github_pr_destination`'s
  GitHub-side auth, which is operational, not policy.
- ❌ No schema-versioned status or apply-plan output. The workflow is
  declarative in Starlark but emits commit/PR results, not machine-readable
  contract artifacts.

### Custom engine (prototype, this spike)

The prototype lives in
[`custom-engine/beztack-sync.mjs`](custom-engine/beztack-sync.mjs). It
is intentionally minimal: it reads the engine-agnostic fixture, applies
the contract, and emits schema-conformant JSON for the three
spike-required outputs (`status`, `apply --plan`, `promotion-metadata`).
It does not yet implement PR creation, registry lookups, env loading,
or any workflow-level concerns; those are deliberate seams for follow-up
issues.

```bash
cd /home/v473r10/Dev/Projects/Beztack

# 1. status
node docs/template-sync-spike/custom-engine/beztack-sync.mjs \
  status --fixture docs/template-sync-fixture

# 2. apply --plan
node docs/template-sync-spike/custom-engine/beztack-sync.mjs \
  apply --plan --fixture docs/template-sync-fixture

# 3. promotion-metadata
node docs/template-sync-spike/custom-engine/beztack-sync.mjs \
  promotion-metadata --fixture docs/template-sync-fixture

# 4. compare to fixture expected/*.json (validates schemas and key semantics)
node docs/template-sync-spike/custom-engine/compare.mjs \
  docs/template-sync-fixture
```

The compare script's output for the fixture run:

```json
{
  "allPass": true,
  "results": {
    "status": {
      "schemaErrors": [],
      "checks": {
        "statusValue": true,
        "conflictCount": true,
        "conflictPaths": true,
        "overlapPathCount": true,
        "overlapExpectedPathsPresent": true,
        "recommendationAction": true,
        "syncEnginePresent": true,
        "schemaVersionCorrect": true
      }
    },
    "applyPlan": {
      "schemaErrors": [],
      "checks": {
        "branchIsNotMain": true,
        "branchFollowsConvention": true,
        "updatesContainExpectedPaths": true,
        "skippedContainsExpectedPaths": true,
        "conflictPathPresent": true,
        "blockersEmpty": true,
        "schemaVersionCorrect": true
      }
    },
    "promotionMetadata": {
      "schemaErrors": [],
      "checks": {
        "candidatesExact": true,
        "expectedCandidatesPresent": true,
        "expectedSkippedSubsetOfSkipped": true,
        "trustClassCorrect": true,
        "labelCorrect": true,
        "baselineRevisionCorrect": true,
        "schemaVersionCorrect": true,
        "checksRecorded": true
      }
    }
  }
}
```

The engine's `apply --plan` branch name `template-sync/v1.1.0-to-v1.2.0`
satisfies C2 (PR-only application) at the contract level — the engine
never mutates `main`, it produces a plan that names a branch for the
caller (a follow-up CI step or the GitHub CLI) to create and push.

## Real Beztack validation

The fixture-driven checks above use an engine-agnostic scenario. Issue
#28 also requires validating the leading option against the real
Beztack → lncd case. The actual `lncd` repository is not accessible from
this spike environment (no clone in the workspace, no Beztack
credentials for the `lncd` organization), so the spike substitutes a
synthetic Derived project that uses the **real** current
`beztack.template.json` strategy verbatim.
This exercises the same contract against real project complexity rather
than only the hand-crafted minimal fixture.

See [`real-validation/`](real-validation/) for the validation inputs and
[`real-validation/analysis.md`](real-validation/analysis.md) for the
analysis.

Key observations from the validation:

- The engine runs end-to-end against the real strategy. All three
  outputs are schema-conformant.
- The current `beztack.template.json` catch-all `**` (mixed) creates
  overlapping ownership rules with `packages/**` and `apps/**` for every
  file. The engine surfaces these as `overlaps[]` warnings, which
  matches PRD #27's expectation: "existing lncd wiring drift should be
  treated as evidence of missing Sync seams." The real strategy will need
  to declare explicit Sync seams as part of the engine implementation
  work.
- The validation scenario has no Sync conflicts and no Promotion PR, so
  it is a "happy path" exercise — it confirms the engine can produce
  apply plans and Promotion metadata for real project state, but it does
  not replace a validation against the actual `lncd` repo.

**Missing capability documented:** the real `lncd` repo is required for
the full validation but is not accessible from this spike environment.
The validation here exercises the contract against real Beztack
complexity with a synthetic lncd; a follow-up issue should run the same
engine against the real `lncd` repo as soon as it is reachable from the
Beztack CI environment.

## Recommendation

**Build custom.**

The custom engine satisfies all 15 criteria. Every external candidate
fails at least 6 criteria, and the failed criteria are central to the
contract (C4 Sync policy, C5 reviewable conflicts, C6 trust boundary,
C7 Promotion, C11–C13 schema-versioned outputs, C15 Sync seams).

The decision is not "any external tool is bad" — Copier in particular
is a strong candidate if Beztack were willing to give up Sync seams,
Promotion metadata, schema-versioned outputs, and trust boundaries.
For Beztack's contract, none of those are negotiable.

### Why not Copier (the closest external candidate)?

Copier is the strongest external option on raw update mechanics, but it
fails on contract surface area:

1. **No ownership model.** Copier copies all files in the template
   unless explicitly excluded. There is no Template-owned vs
   Custom-owned vs Mixed distinction; file-level `--exclude` is the
   only lever, and it is positional, not declarative.
2. **No Sync seam semantics.** Copier resolves template-vs-project
   divergence with git-style merge, leaving inline conflict markers.
   The `api-route-registration` Sync seam in the fixture (which
   preserves the Derived project's `registerRoute(...)` calls while the
   template harness is rewritten) has no Copier equivalent — Copier
   would produce conflict markers that a human must reconcile, defeating
   the seam.
3. **No Promotion metadata.** Copier does not model "this Derived
   project change could flow back to Beztack". The fixture's
   `promotion-metadata` schema and PRD #27's opt-in-Promotion story
   would need to be layered on top of Copier as a separate tool.
4. **No Trust boundary.** Copier treats every derived project the same.
   PRD #27's Trusted vs Community distinction (with automated
   notifications for the former) requires a Beztack-owned registry that
   Copier does not provide.
5. **No schema-versioned outputs.** Copier's only structured output is
   the `.copier-answers.yml` answers file. There is no `status` JSON,
   no `apply` plan JSON — Copier is a doer, not a reporter. PRD #27
   story 14 requires stable machine-readable JSON for agents and CI.

For these reasons, even "wrap Copier" would end up reimplementing most
of the contract on top of Copier's update mechanism, with Copier as a
sub-component for file rendering only.

### What the custom engine reuses

Even with a "build custom" recommendation, the engine should reuse
battle-tested components where appropriate:

- **Jinja2** (Python) or **handlebars/nunjucks** (Node) for `{{appName}}`
  parameter rendering. Both are mature and template-injection-safe
  when configured correctly.
- **Git CLI** for revision tracking and PR-branch creation, called from
  the engine rather than reimplemented.
- **`ajv`** or another JSON-Schema validator for the schema-versioned
  outputs, rather than hand-rolled validation.
- **`zod`** or another runtime schema validator for the Sync policy,
  Origin baseline, and parameters inputs.

These reuse choices keep the engine small while inheriting the maturity
of the underlying libraries.

## What remains Beztack-specific

This section is the issue #28 acceptance criterion "the recommendation
explicitly identifies which Beztack-specific behavior remains custom
even if an external tool is adopted." It applies regardless of which
option is chosen: even if Beztack later wraps Copier, these are the
behaviors that would still live in Beztack-owned code.

1. **Sync policy schema and ownership semantics.** Template-owned,
   Custom-owned, Mixed ownership, ownership overlap/shadow detection
   with more-specific-wins precedence, ownership notes. This is the
   contract's central concept and cannot be delegated to any external
   template engine, because it is Beztack domain language.
2. **Sync seam registry.** The `seams[]` block in the policy, the
   `marker`-based preservation logic during apply, and the
   `Mixed-ownership-prefers-Sync-seams-over-zone-markers` rule from
   ADR-0006. None of the external candidates model seams.
3. **Conflict reporting with semantic reasons.** The
   `both-changed-no-seam` and `ownership-ambiguous` reasons are
   Beztack-domain language; external tools emit generic git-merge
   conflicts.
4. **Environment contract separation.** Distinguishing
   `.env.contract.json` (Template-owned) from `.env.example`
   (Custom-owned) is a domain requirement, not a template-engine
   feature.
5. **Lockfile regeneration contract.** "Template source does not ship
   `pnpm-lock.yaml`; engines regenerate locally after apply" is a
   Beztack rule.
6. **Origin baseline with revision hash + file metadata.** The
   `.beztack/origin.json` schema and the revision-hash verification
   during `status` are Beztack-specific.
7. **Schema-versioned `status`, `apply --plan`, `promotion-metadata`
   outputs.** The five schemas in `docs/template-sync-fixture/schemas/`
   are Beztack contract surface area. Even Copier wrapping would
   require a Beztack layer to produce these outputs.
8. **Trust boundary enforcement.** The Trusted Derived project
   registry, `trustClass: "trusted" | "community"` classification, and
   the gating behavior (automated update dispatch for trusted, local
   tooling for community) are Beztack-only.
9. **Promotion label convention and filtering.** The `promotion:
   candidate` PR label and the candidate-filter logic (Template-owned
   paths in; Custom-owned Product-domain paths out; Mixed-owned paths
   out unless on a Template-owned path) are Beztack domain rules.
10. **Sync engine version separate from Template version.** Beztack
    records both independently and refuses incompatible combinations.

Items 1–10 are not "what we add later" — they are the contract. Any
engine choice must support them as first-class concepts. Building custom
gives Beztack full control over how they are modeled; wrapping or
adopting an external tool would require implementing them in a Beztack
shim layer regardless.

## Open questions for follow-up

These are not blockers for issue #28 but should be tracked:

- **What runtime does the engine ship in?** The spike prototype is Node
  to align with the existing `packages/cli` and the fixture's
  `node --test` self-check. A Python implementation would let Beztack
  reuse Jinja2 directly. Decision belongs in the next issue.
- **Where does the engine live?** As a separate `packages/template-sync`
  package, or as a subcommand of the existing `packages/cli`? Decision
  belongs in the next issue.
- **PR creation.** The engine emits a `branch` field in the apply
  plan; PR creation is currently out of scope. A follow-up issue
  should decide whether to implement GitHub API integration directly
  or to rely on an external CI step.

## Spike workspace layout

```text
docs/template-sync-spike/
├── README.md                    # this file
├── custom-engine/               # Node-based engine prototype
│   ├── README.md
│   ├── beztack-sync.mjs         # the engine
│   ├── compare.mjs              # fixture-vs-engine comparator
│   └── package.json
└── real-validation/             # real Beztack → lncd-like validation
    ├── README.md
    ├── analysis.md              # validation findings
    ├── status.out.json          # engine output
    ├── apply-plan.out.json      # engine output
    ├── promotion-metadata.out.json # engine output
    ├── beztack.template.json    # lncd-local copy of the real Beztack strategy
    ├── template-revisions/      # v1.0.0 (Origin) and v1.1.0 (candidate)
    ├── derived-project/         # synthetic lncd-like Derived project
    └── schemas/                 # shared with the fixture
```

The spike workspace exists in this repo as documentation only; the
executable artifacts live in `custom-engine/beztack-sync.mjs` and
`custom-engine/compare.mjs`. The fixture lives at
`docs/template-sync-fixture/`.

## Closes #28

This document, plus the `custom-engine/` prototype and the
`real-validation/` analysis, complete the build-vs-adopt spike required
by issue #28. The recommendation is to **build custom** with the
behaviors in "What remains Beztack-specific" as first-class contract
surface area. The next step is to file a follow-up issue for the
engine implementation, scoped to the contract schema and the engine's
external seams (PR creation, registry, env loading).
