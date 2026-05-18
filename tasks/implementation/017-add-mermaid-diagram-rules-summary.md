---
id: "017"
issue: "issues/017-add-mermaid-diagram-rules-to-plan-it-skill.md"
created: 2026-05-17
updated: 2026-05-17
---

# Implementation Summary: Add conditional Mermaid diagram rules to the plan-it skill

## Related Task

- `issues/017-add-mermaid-diagram-rules-to-plan-it-skill.md`

## Files Changed

- `skills/plan-it/references/diagram-rules.md` — new reference file: trigger condition, diagram-type-to-use-case mapping, placement rules per document type, formatting rules, and anti-patterns
- `skills/plan-it/SKILL.md` — added step 9 (diagram merit evaluation) in the Core Workflow; renumbered former steps 9–13 to 10–14
- `skills/plan-it/references/planning-rules.md` — added diagram reference sentence in the Context section and a note in the ADR planning section
- `skills/plan-it/references/adr-rules.md` — added new "ADR diagram rule" section with Good/Bad examples and reference to `diagram-rules.md`
- `skills/plan-it/assets/task-template.md` — added optional diagram placeholder comment in the Context section
- `implementation/017-add-mermaid-diagram-rules-summary.md` — this file

## Behavior Implemented

- Planners (human or agent) following the updated `SKILL.md` workflow now have an explicit step to evaluate diagram merit before writing task issues.
- The trigger condition (≥3 interacting components, or flow not expressible in ≤3 bullets) is stated consistently in ≤2 sentences wherever it appears across all files.
- `diagram-rules.md` provides a mutually exclusive type → use case mapping so a planner never has to guess between `flowchart` and `sequenceDiagram`.
- Placement rules specify where diagrams go in task issues (Context section), ADRs (Options Considered), and CONTEXT.md (top-level overview).
- The task template optional placeholder is clearly conditional — a planner filling a simple task is not prompted to include a diagram.
- ADR stubs may now include one comparative Mermaid diagram in Options Considered when options have topological differences.

## Design Notes

- `diagram-rules.md` is written in the same heading-anchored, terse style as `planning-rules.md` and `adr-rules.md`: short sections, Good/Bad examples, no prose essays.
- All cross-references from `SKILL.md` use relative paths matching the existing pattern (`references/diagram-rules.md`). References from within the `references/` directory use peer-relative paths (`diagram-rules.md`).
- The new SKILL.md step 9 is worded to mirror the style of adjacent steps: imperative verb, trigger condition inline, parenthetical reference to the rules file.
- No existing required section in any edited file was removed or restructured.

## Tests Added or Updated

- Not applicable — all changes are static markdown files with no executable code.

## Test Categories Not Applicable

- `Unit`: Not applicable — no executable code; changes are markdown documentation only.
- `Integration`: Not applicable — no code boundaries; all changes are to static markdown files.
- `Smoke`: Not applicable — no build or deploy artifact.
- `E2E`: Not applicable — no user-facing application behavior changes.
- `Regression`: Not applicable — no known prior defect being fixed.
- `Performance`: Not applicable — no runtime behavior introduced.
- `Security`: Not applicable — no authentication, authorization, or data boundary changes.
- `Observability`: Not applicable — no logs, metrics, traces, or analytics events affected.

## Validation Run

```text
find skills/plan-it/references -name "diagram-rules.md" — file exists
find skills/plan-it/assets -name "task-template.md" — file exists with optional placeholder
grep "diagram-rules.md" skills/plan-it/SKILL.md — step 9 present with correct relative path
grep "diagram-rules.md" skills/plan-it/references/planning-rules.md — two references present (Context section, ADR planning section)
grep "diagram-rules.md" skills/plan-it/references/adr-rules.md — new ADR diagram rule section references correct path
```

## Accessibility Notes

Not applicable — this task does not change user-facing UI.

## Observability Changes

Not applicable — skill definition; no runtime to instrument.

## ADR Updates

Not applicable — this task edits markdown reference files only and introduces no irreversible architecture decision.

## Unresolved Assumptions or Follow-Up

- Usability tests `UX-001` and `UX-002` (manual agent invocation on multi-component vs. single-component tasks) require a live plan-it run to verify — not blocked, deferred to first real usage of the updated skill.
