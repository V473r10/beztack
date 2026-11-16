# Issue tracker: Linear

Issues and specs for this repo live in Linear, workspace `beztack`, team **BZ** (`Beztack`). Agents reach it through the Linear MCP server (`linear-beztack`).

Linear syncs its issues to GitHub Issues in `V473r10/beztack`. The GitHub issues are a mirror, not the source: read and write in Linear, and never edit or close the GitHub copy (the sync overwrites it).

## Conventions

- **Create an issue**: `save_issue` without `id`, with `team: "Beztack"`, a `title`, a Markdown `description`, and `labels`. Check `list_issues` first for a duplicate.
- **Read an issue**: `get_issue` with the identifier (`BZ-132`). It does not include the discussion: call `list_comments` for the comments.
- **List issues**: `list_issues` with `team`, `state`, `label`, `parentId` or `query` filters. Follow `cursor` while `hasNextPage` is true.
- **Comment on an issue**: `save_comment` with the issue identifier and a Markdown `body`.
- **Apply / remove labels**: `save_issue` with `id` and `addLabels` / `removeLabels` (`labels` replaces the whole set, so avoid it for incremental changes). Available labels: `list_issue_labels` with `team: "Beztack"`.
- **Change state**: `save_issue` with `id` and `state`. The states are `Backlog`, `Todo`, `In Progress`, `In Review`, `Done`, `Canceled` and `Duplicate`.
- **Close**: `save_issue` with `state: "Done"` (or `Canceled` / `Duplicate`, with `duplicateOf` for the latter) and a closing comment.

Triage roles are labels from `triage-labels.md`, paired with the workflow state: `needs-triage` -> `Backlog`, `ready-for-agent` / `ready-for-human` -> `Todo`, `wontfix` -> `Canceled`.

## Branches and PRs

Name the branch with Linear's pattern, the lower-case identifier followed by a short title (for example `bz-132-short-title`), or use the `gitBranchName` that Linear gives the issue. Linear links a PR to the issue when the branch name or the PR title contains the identifier (`bz-132` or `BZ-132`). Use `Fixes BZ-<n>` in the PR body when the PR closes the ticket.

## When a skill says "publish to the issue tracker"

Create a Linear issue in team BZ with `save_issue`, with the triage label and the matching state.

## When a skill says "fetch the relevant ticket"

Run `get_issue` with the identifier, then `list_comments` for the discussion. Read the parent issue when the ticket points at a spec.

## Wayfinding operations

Used by `/wayfinder`. The labels `wayfinder:map`, `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling` and `wayfinder:task` exist in team BZ.

- **Map**: an issue labelled `wayfinder:map`. Find maps with `list_issues` filtered by `label: "wayfinder:map"` (include closed states).
- **Ticket**: create it with `save_issue`, one of the four ticket labels, and `parentId` set to the map. Sub-issues are Linear's native parent/child relation.
- **Blocking**: mark `<ticket>` as blocked by `<blocker>` with `save_issue` on the ticket and `blockedBy: ["<blocker>"]` (the native "blocked by" relation). Remove one with `removeBlockedBy`. Read a ticket's blockers with `get_issue` and `includeRelations: true`.
- **Claim**: `save_issue` with `assignee: "me"` and `state: "In Progress"`.
- **Frontier**: children of the map (`list_issues` with `parentId: "<map>"`) in state `Backlog` or `Todo`, with no assignee, whose blockers are all `Done` or `Canceled`. Lowest number first.
- **Resolve**: `save_comment` on the ticket with the resolution, set `state: "Done"`, then update the map's Decisions so far with `save_issue` on the map (`patch` for a partial edit).
