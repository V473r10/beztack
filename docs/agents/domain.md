# Domain Docs

Confirmed layout: single-context.

Engineering skills should consume this repo's domain documentation as follows.

## Before Exploring, Read These

- **`CONTEXT.md`** at the repo root.
- **`docs/adr/`** at the repo root. Read ADRs that touch the area you're about to work in.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The producer skill (`/grill-with-docs`) creates them lazily when terms or decisions actually get resolved.

## File Structure

```text
/
+-- CONTEXT.md
+-- docs/adr/
|   +-- 0001-example-decision.md
|   +-- 0002-example-decision.md
+-- apps/
```

## Use the Glossary's Vocabulary

When your output names a domain concept in an issue title, a refactor proposal, a hypothesis, or a test name, use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use, or there's a real gap to note for `/grill-with-docs`.

## Flag ADR Conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders), but worth reopening because..._
