---
id: "021"
created: 2026-05-19
updated: 2026-05-19
status: active
---

# Task: Apply safe implement-it refactors and validate against champion

## Priority

P1 — Depends on task 019. Champion baseline for implement-it must exist in MLflow.

## Dependencies

- Depends on Task 019: champion baseline for implement-it promoted in MLflow.
- No ADR dependency.

## Assignability

**AFK** — all target files, line ranges, and replacement content are fully specified.

## Context

Three low-risk changes to the implement-it skill:

- **I-1** (`SKILL.md:17–26`): The 10-line design principles preamble is nearly verbatim the `Design goal` section of `design-rules.md:1–17`. The SKILL.md version loads unconditionally on every activation; `design-rules.md` loads conditionally at step 9. The preamble provides an always-on default constraint ("apply selectively"), which should be preserved — but as a single-line pointer, not a 10-line restatement. The replacement must be exactly one line so the always-on constraint is not lost entirely.
- **X-2** (`SKILL.md:74–79`): The `Before marking complete` checklist has 6 items. Four restate steps 11, 14, 15, and 13 of the workflow. Two are non-obvious: accessibility checks (easy to defer) and no-unrelated-files (a fresh verification, not a workflow step).
- **X-4** (`SKILL.md:55`): The reference to `../plan-it/assets/context-template.md` is a fragile cross-skill relative path. Replace with `assets/context-template.md` and create `skills/implement-it/assets/context-template.md` as a copy of the plan-it version.

## Use Cases

- **Feature**: Skill token efficiency
- **Scenario**: Benchmark confirms no regression after implement-it refactor
- **Given** the refactored implement-it skill in `skills/implement-it-lean/`
- **When** the benchmark runs with `--skill-dir ../skills/implement-it-lean`
- **Then** `bench-compare --skill implement-it` shows the variant within 0.05 of the champion on `behave_pass_rate` and `f1`

## Definition of Ready

- Task 019 complete: champion baseline for implement-it is promoted in MLflow.
- `skills/implement-it/` is at the committed state matching the champion hash.
- `skills/plan-it/assets/context-template.md` exists (source for the copy).

## Functional Requirements

- `FR-001`: `skills/implement-it-lean/SKILL.md` lines 17–26 are replaced with exactly one line: `Use design principles selectively — read [design-rules.md](references/design-rules.md) when a design decision arises.`
- `FR-002`: `skills/implement-it-lean/SKILL.md` `Before marking complete` checklist contains exactly two items: accessibility checks and no-unrelated-files. Items that restate steps 11, 13, 14, and 15 are removed.
- `FR-003`: `skills/implement-it-lean/assets/context-template.md` exists and is byte-for-byte identical to `skills/plan-it/assets/context-template.md`.
- `FR-004`: `skills/implement-it-lean/SKILL.md:55` references `assets/context-template.md` (not `../plan-it/assets/context-template.md`).
- `FR-005`: Benchmark variant run with 5 trials produces `behave_pass_rate` mean within 0.05 of champion and `f1` mean within 0.05 of champion.
- `FR-006`: Benchmark variant run produces `input_tokens` mean ≤ champion's mean.
- `FR-007`: If `FR-005` and `FR-006` pass, the variant is promoted as the new champion for implement-it.

## Non-Functional Requirements

- `NFR-001`: The variant directory `skills/implement-it-lean/` is a full copy of `skills/implement-it/` with only the three targeted edits applied.
- `NFR-002`: The single-line replacement for I-1 (`FR-001`) preserves the word "selectively" — the core always-on behavioral constraint.

## Observability Requirements

- `OBS-001`: Benchmark run logs `behave_pass_rate`, `f1`, `quality_score`, `input_tokens`, and `output_tokens` per trial to MLflow, tagged with `skill_content_hash`.
- `OBS-002`: `bench-compare --skill implement-it` output is captured in the implementation summary.

## Acceptance Criteria

- `AC-001`: **Given** `skills/implement-it-lean/SKILL.md`, **When** lines 17–26 are read, **Then** they contain exactly one line that includes "selectively" and a link to `design-rules.md`.
- `AC-002`: **Given** `skills/implement-it-lean/SKILL.md`, **When** the `Before marking complete` section is read, **Then** it contains exactly two checklist items (accessibility and no-unrelated-files).
- `AC-003`: **Given** `diff skills/plan-it/assets/context-template.md skills/implement-it-lean/assets/context-template.md`, **When** the diff runs, **Then** output is empty (files are identical).
- `AC-004`: **Given** `skills/implement-it-lean/SKILL.md:55`, **When** the line is read, **Then** it references `assets/context-template.md` with no `../plan-it/` prefix.
- `AC-005`: **Given** the benchmark variant run completes, **When** `bench-compare --skill implement-it` is shown, **Then** the variant's `behave_pass_rate` is within 0.05 of the champion and `f1` is within 0.05 of the champion.

## Required Tests

### Unit Tests

- `UT-001`: Not applicable — changes are text edits; no new logic introduced.

### Integration Tests

- `IT-001`: **Scenario**: Variant benchmark run completes  
  **Given** `skills/implement-it-lean/` with three edits applied  
  **When** `uv run python run.py --skill implement-it --platform pi-agent --model openai-codex/gpt-5.4-mini --trials 5 --skill-dir ../skills/implement-it-lean` completes  
  **Then** MLflow contains 5 `with_skill` and 5 `without_skill` trial runs with the variant's `skill_content_hash`  
  Covers `FR-005`, `FR-006`, `OBS-001`.

- `IT-002`: **Scenario**: Variant meets quality thresholds  
  **Given** the benchmark summary logged per IT-001  
  **When** `bench-compare --skill implement-it` is run  
  **Then** the variant row shows `behave_pass_rate` and `f1` within 0.05 of champion  
  Covers `FR-005`, `AC-005`.

- `IT-003`: **Scenario**: Context template files are identical  
  **Given** `skills/plan-it/assets/context-template.md` and `skills/implement-it-lean/assets/context-template.md` exist  
  **When** `diff` runs on both files  
  **Then** diff output is empty  
  Covers `FR-003`, `AC-003`.

### Smoke Tests

- `SMK-001`: Not applicable.

### End-to-End Tests

- `E2E-001`: Not applicable.

### Regression Tests

- `REG-001`: Not applicable.

### Performance Tests

- `PT-001`: Not applicable.

### Security Tests

- `ST-001`: Not applicable.

### Usability Tests

- `UX-001`: Not applicable.

### Observability Tests

- `OT-001`: Not applicable.

## Definition of Done

- `skills/implement-it-lean/` exists as a full copy with exactly three targeted edits.
- All four ACs (AC-001 through AC-004) verified by diff and `cat`.
- Benchmark run completed; MLflow summary logged with variant hash.
- `bench-compare` output confirms thresholds met (AC-005).
- If thresholds met: variant promoted as champion; `skills/implement-it/` updated to match; variant directory removed.
- If thresholds not met: implementation summary documents the regressed metric; no promotion; no merge.
- Required telemetry is implemented and verified.
- Required ADRs are updated from `Proposed` to `Accepted` or left with explicit open questions.
