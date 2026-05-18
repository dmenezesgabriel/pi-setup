---
id: "017"
created: 2026-05-17
updated: 2026-05-17
status: active
---

# Task: Add conditional Mermaid diagram rules to the plan-it skill

## Priority

P0 — Self-contained improvement to the plan-it skill with no upstream dependency. Unblocks any future plan that benefits from visual clarity on complex multi-component tasks.

## Dependencies

- No task dependency; can start immediately.
- No ADR dependency; this task edits markdown reference files only and introduces no irreversible architecture decision.
- The `skills/plan-it/` directory must exist with its current structure (`references/`, `assets/`, `SKILL.md`).

## Assignability

**AFK** — all requirements and acceptance criteria are fully specified. All target files are known. No irreversible architectural decisions remain open. Safe to delegate to an autonomous agent without mid-task review.

## Context

The plan-it skill generates task issues, ADRs, and CONTEXT.md entries. Currently none of these documents include visual diagrams, which means multi-component interactions, state machines, data models, and architecture options are described only in prose. For complex plans this forces the reader to mentally assemble the picture from bullet points.

Mermaid.js diagrams embedded in markdown fenced code blocks (` ```mermaid `) are the standard solution: they render in GitHub, GitLab, and most markdown viewers, are readable as plain text when unrendered, and carry negligible token overhead (~15–30 lines per diagram).

The goal is **conditional, merit-based inclusion** — not diagrams by default. A diagram should appear only when the relationship or flow cannot be expressed clearly in three or fewer bullet points, or when three or more components interact. This keeps simple task documents clean and avoids token waste on single-component changes.

The changes are purely to markdown files inside `skills/plan-it/`. No code, no runtime behavior.

## Use Cases

- **Feature**: Conditional Mermaid diagram inclusion in plan-it output
- **Scenario**: Planner encounters a multi-service task
- **Given** a plan-it skill run that involves a task with 4 interacting services
- **When** the planner reads `diagram-rules.md` to decide whether to include a diagram
- **Then** the planner finds a clear trigger condition, selects the correct diagram type (`sequenceDiagram`), and embeds it in the task's Context section

---

- **Feature**: Conditional Mermaid diagram inclusion in plan-it output
- **Scenario**: Planner encounters a simple single-component task
- **Given** a plan-it skill run for a task that changes one validation function
- **When** the planner reads `diagram-rules.md`
- **Then** the planner correctly skips diagram inclusion because the behavior is expressible in ≤3 bullet points

---

- **Feature**: Conditional Mermaid diagram inclusion in plan-it output
- **Scenario**: Planner creates an ADR for an architecture decision
- **Given** an ADR comparing three notification delivery options
- **When** the planner reads `adr-rules.md` referencing `diagram-rules.md`
- **Then** the planner includes a `flowchart` in the Options Considered section to contrast the three options visually

## Definition of Ready

- `skills/plan-it/references/` directory exists and contains `planning-rules.md` and `adr-rules.md`.
- `skills/plan-it/assets/task-template.md` exists as the canonical task structure.
- `skills/plan-it/SKILL.md` core workflow steps are numbered and editable.
- No upstream task blocks this work.

## Functional Requirements

- `FR-001`: A new file `skills/plan-it/references/diagram-rules.md` is created containing: trigger conditions for diagram inclusion, a mapping of diagram type to use case, placement rules per document type (task issue, ADR, CONTEXT.md), formatting rules for fenced Mermaid blocks, and anti-patterns to avoid.
- `FR-002`: `skills/plan-it/SKILL.md` core workflow includes a step that instructs the planner to evaluate diagram merit and read `diagram-rules.md` when the trigger condition is met.
- `FR-003`: `skills/plan-it/references/planning-rules.md` references `diagram-rules.md` in the section that describes the Context task section, and in the ADR planning section, so planners know to consider diagrams at the right moment.
- `FR-004`: `skills/plan-it/references/adr-rules.md` adds guidance on when an ADR stub benefits from a diagram (options with topology differences, architecture boundaries, data flows) and references `diagram-rules.md`.
- `FR-005`: `skills/plan-it/assets/task-template.md` adds an optional diagram placeholder in the Context section, clearly marked as conditional on the diagram merit rule.

## Non-Functional Requirements

- `NFR-001`: The trigger condition is stated in ≤2 sentences in every file that references it, so it is instantly recognizable and consistent across files.
- `NFR-002`: Each diagram type listed in `diagram-rules.md` has a distinct, mutually exclusive use case description so a planner never has to guess between `flowchart` and `sequenceDiagram`.
- `NFR-003`: `diagram-rules.md` is written in the same style and structure as existing reference files (`planning-rules.md`, `adr-rules.md`): heading-anchored sections, Good/Bad examples, no prose essays.

## Observability Requirements

- `OBS-001`: Not applicable — this task modifies only static markdown skill files with no runtime, logging, or telemetry behavior.

## Acceptance Criteria

- `AC-001`: **Given** a task issue for a feature involving ≥3 interacting components, **When** a planner follows the updated SKILL.md workflow, **Then** the planner consults `diagram-rules.md`, selects the correct diagram type, and embeds a Mermaid block in the task's Context section.
- `AC-002`: **Given** a task issue for a single-component change, **When** a planner follows the updated workflow, **Then** the planner skips diagram inclusion because the trigger condition is not met.
- `AC-003`: **Given** an ADR comparing two or more architecture options with topological differences, **When** a planner reads the updated `adr-rules.md`, **Then** the planner finds explicit guidance on whether and how to include a diagram in the Options Considered section.
- `AC-004`: **Given** the updated `task-template.md`, **When** a planner fills in the Context section, **Then** the optional diagram placeholder is present but clearly conditional — a planner filling a simple task does not feel obligated to include a diagram.
- `AC-005`: **Given** a CONTEXT.md domain model with ≥4 entities, **When** a planner follows `diagram-rules.md`, **Then** the rules specify that an `erDiagram` or `classDiagram` may be embedded at the top of CONTEXT.md to give readers an overview.

## Required Tests

### Unit Tests

- `UT-001`: Not applicable — no executable code; changes are markdown documentation only.

### Integration Tests

- `IT-001`: Not applicable — no code boundaries; all changes are to static markdown files.

### Smoke Tests

- `SMK-001`: Not applicable — no build or deploy artifact.

### End-to-End Tests

- `E2E-001`: Not applicable — no user-facing application behavior changes.

### Regression Tests

- `REG-001`: Not applicable — no known prior defect being fixed.

### Performance Tests

- `PT-001`: Not applicable — no runtime behavior introduced.

### Security Tests

- `ST-001`: Not applicable — no authentication, authorization, input handling, or data boundary changes.

### Usability Tests

- `UX-001`: Manually verify that an agent following the updated `skills/plan-it/` skill on a multi-component task produces at least one Mermaid diagram in the output, and that an agent following it on a single-component task produces none. Covers `AC-001`, `AC-002`.
- `UX-002`: Manually verify that `diagram-rules.md` Good/Bad examples are sufficient for an agent to select the correct diagram type without ambiguity. Covers `NFR-002`.

### Observability Tests

- `OT-001`: Not applicable — no logs, metrics, traces, or analytics events affected.

## Definition of Done

- `skills/plan-it/references/diagram-rules.md` exists with all required sections: trigger condition, diagram-type-to-use-case mapping, placement rules, formatting rules, and anti-patterns.
- `skills/plan-it/SKILL.md` core workflow contains a step referencing `diagram-rules.md`.
- `skills/plan-it/references/planning-rules.md` references `diagram-rules.md` in the Context section guidance and ADR planning section.
- `skills/plan-it/references/adr-rules.md` references `diagram-rules.md` with diagram guidance for ADR option comparison.
- `skills/plan-it/assets/task-template.md` Context section includes an optional diagram placeholder with the merit condition stated inline.
- All cross-references between files use the correct relative paths.
- No existing required section in any edited file is removed or broken.
