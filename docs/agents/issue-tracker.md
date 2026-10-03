# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues in `V473r10/beztack`. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v`; `gh` does this automatically when run inside a clone.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Wayfinding operations

GitHub has native sub-issues and native blocking (issue dependencies). Both REST endpoints take the issue's database `id`, not its number: get it with `gh api repos/V473r10/beztack/issues/<number> --jq .id`.

- **Map**: an issue labelled `wayfinder:map`. Find maps with `gh issue list --label wayfinder:map --state all`.
- **Ticket**: create it with `gh issue create` plus one of `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, `wayfinder:task`, then attach it to the map:
  `gh api -X POST repos/V473r10/beztack/issues/<map>/sub_issues -F sub_issue_id=<ticket id>`
- **Blocking**: mark `<ticket>` as blocked by `<blocker>`:
  `gh api -X POST repos/V473r10/beztack/issues/<ticket>/dependencies/blocked_by -F issue_id=<blocker id>`
  Read a ticket's blockers with `gh api repos/V473r10/beztack/issues/<ticket>/dependencies/blocked_by --jq '[.[] | {number, state}]'`.
- **Claim**: `gh issue edit <ticket> --add-assignee @me`.
- **Frontier** (open, unblocked, unclaimed children of the map):
  ```sh
  gh api repos/V473r10/beztack/issues/<map>/sub_issues --paginate \
    --jq '[.[] | select(.state == "open" and (.assignees | length) == 0 and .issue_dependencies_summary.blocked_by == 0) | {number, title, labels: [.labels[].name]}]'
  ```
  `issue_dependencies_summary.blocked_by` counts only open blockers, so a ticket whose blockers are all closed shows `0`.
- **Resolve**: `gh issue comment <ticket> --body "<resolution>"`, then `gh issue close <ticket>`, then edit the map body's Decisions so far with `gh issue edit <map> --body-file <file>`.
