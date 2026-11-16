# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker (Linear, team BZ). All of them exist as Linear labels.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role, use the corresponding label string from this table. Pair the label with the workflow state: `needs-triage` -> `Backlog`, `ready-for-*` -> `Todo`, `wontfix` -> `Canceled`.

## Factory loop labels

These two are not triage roles. The factory loop reads them.

| Label         | Meaning                                                                                                                                         |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `auto-merge`  | Low risk: the factory loop may merge and deploy this ticket on its own when CI and Codex review pass. Set only by Facundo; agents never add it. |
| `needs-human` | The factory loop stopped on this ticket and a human must look. The loop sets it and does not pick the ticket up again until it is removed.      |
