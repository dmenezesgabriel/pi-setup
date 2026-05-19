---
id: "020"
created: 2026-05-19
updated: 2026-05-19
status: active
---

# Task: Apply safe plan-it refactors and validate against champion

## Priority

P1 — Depends on task 019. Champion baseline must be established before this task runs so that regressions are detectable.

## Dependencies

- Depends on Task 019: champion baseline for plan-it promoted in MLflow.
- No ADR dependency — no architectural decisions involved.

## Assignability

**AFK** — all target files, line ranges, and replacement content are fully specified. Validation commands are explicit.

## Context

Four low-risk changes to the plan-it skill were identified. Each removes text that either duplicates content already present in a referenced file or duplicates a numbered workflow step that the agent has already executed before reaching that point.

Changes in scope:
- **P-2** (`references/output-files.md:17–26`): Replace the 4-step prose algorithm for issue numbering with a single `bash scripts/next-issue-number.sh` invocation plus a one-sentence fallback. The script already implements the algorithm correctly; the prose risks the agent reimplementing it inconsistently.
- **P-3** (`SKILL.md:43–81`): Strip the prose restatements from the `Issue output requirement` and `ADR output requirement` sections. Keep only the `mkdir` commands. The naming conventions and criteria are already in `output-files.md` which step 12 directs the agent to read.
- **X-2** (`SKILL.md:83–89`): Trim the `Before marking complete` checklist from 5 items to 1. Four items restate steps 12, 13, 11, and 14 of the workflow; the only non-obvious item is the `CONTEXT.md` update reminder.
- **X-3** (`assets/adr-template.md:9`): Standardize the date placeholder from `<YYYY-MM-DD>` (angle brackets) to `{{YYYY-MM-DD}}` (mustache), matching the format used in `task-template.md` and `implementation-summary-template.md`.

After applying changes, a benchmark variant run measures whether the changes introduce any regression in `behave_pass_rate`, `f1`, or `quality_score` relative to the promoted champion.

## Use Cases

- **Feature**: Skill token efficiency
- **Scenario**: Benchmark confirms no regression after plan-it refactor
- **Given** the refactored plan-it skill in `skills/plan-it-lean/`
- **When** the benchmark runs with `--skill-dir ../skills/plan-it-lean`
- **Then** `bench-compare --skill plan-it` shows the variant within 0.05 of the champion on `behave_pass_rate` and `f1`
- **And** `input_tokens` is less than or equal to the champion's mean

## Definition of Ready

- Task 019 complete: champion baseline for plan-it is promoted in MLflow.
- `skills/plan-it/` is at the committed state matching the champion hash.
- `uv run python run.py --skill plan-it` runs without error.

## Functional Requirements

- `FR-001`: `skills/plan-it-lean/references/output-files.md` issue numbering rule (previously lines 17–26) reads:
  ```
  Before writing each issue file, get the next number by running:

      NUM=$(bash scripts/next-issue-number.sh)

  Use `$NUM` as the filename prefix (e.g. `004`). The script reads or initialises
  `issues-lock.json` and prints the zero-padded number. Call it once per issue file.

  If the script is unavailable, fall back to reading `issues-lock.json` directly:
  read `next_id`, use it zero-padded, and write `next_id + 1` back.
  ```
- `FR-002`: `skills/plan-it-lean/SKILL.md` `Issue output requirement` section contains only the `mkdir -p tasks/issues` command and no prose restatement of step 12 or naming format examples.
- `FR-003`: `skills/plan-it-lean/SKILL.md` `ADR output requirement` section contains only the `mkdir -p docs/adrs` command and no prose restatement of criteria or naming format examples.
- `FR-004`: `skills/plan-it-lean/SKILL.md` `Before marking complete` checklist contains exactly one item: the `CONTEXT.md` update reminder.
- `FR-005`: `skills/plan-it-lean/assets/adr-template.md` line 9 uses `{{YYYY-MM-DD}}` (not `<YYYY-MM-DD>`).
- `FR-006`: Benchmark variant run with 5 trials produces `behave_pass_rate` mean within 0.05 of the champion and `f1` mean within 0.05 of the champion.
- `FR-007`: Benchmark variant run produces `input_tokens` mean ≤ champion's `input_tokens` mean.
- `FR-008`: If `FR-006` and `FR-007` pass, the variant is promoted as the new champion for plan-it.

## Non-Functional Requirements

- `NFR-001`: The variant directory `skills/plan-it-lean/` is a full copy of `skills/plan-it/` with only the four targeted edits applied — no other files changed.
- `NFR-002`: All other content in the edited files (Good/Bad examples not in the trimmed sections, rule text, cross-references) is preserved verbatim.

## Observability Requirements

- `OBS-001`: Benchmark run logs `behave_pass_rate`, `f1`, `quality_score`, `input_tokens`, and `output_tokens` per trial to MLflow, tagged with the variant's `skill_content_hash`.
- `OBS-002`: `bench-compare --skill plan-it` output is captured and included in the implementation summary.

## Acceptance Criteria

- `AC-001`: **Given** `skills/plan-it-lean/references/output-files.md`, **When** the issue numbering rule is read, **Then** it is a `bash scripts/next-issue-number.sh` invocation with fallback clause — not a 4-step algorithm.
- `AC-002`: **Given** `skills/plan-it-lean/SKILL.md`, **When** the `Issue output requirement` section is read, **Then** it contains the `mkdir` command and nothing else (no prose, no naming examples).
- `AC-003`: **Given** `skills/plan-it-lean/SKILL.md`, **When** the `Before marking complete` section is read, **Then** it contains exactly one checklist item.
- `AC-004`: **Given** `skills/plan-it-lean/assets/adr-template.md`, **When** the date placeholder is read, **Then** it is `{{YYYY-MM-DD}}`.
- `AC-005`: **Given** the benchmark variant run completes, **When** `bench-compare --skill plan-it` is shown, **Then** the variant's `behave_pass_rate` is within 0.05 of the champion and `f1` is within 0.05 of the champion.
- `AC-006`: **Given** AC-005 passes, **When** `bench-promote` is run for the variant hash, **Then** `bench-compare` shows the new hash as `★ champion`.

## Required Tests

### Unit Tests

- `UT-001`: Not applicable — changes are pure text edits with no new logic.

### Integration Tests

- `IT-001`: **Scenario**: Variant benchmark run completes without errors  
  **Given** `skills/plan-it-lean/` with the four edits applied  
  **When** `uv run python run.py --skill plan-it --platform pi-agent --model openai-codex/gpt-5.4-mini --trials 5 --skill-dir ../skills/plan-it-lean` completes  
  **Then** MLflow contains 5 `with_skill` trial runs and 5 `without_skill` trial runs  
  **And** a summary run is logged with the variant's `skill_content_hash`  
  Covers `FR-006`, `FR-007`, `OBS-001`.

- `IT-002`: **Scenario**: Variant meets quality thresholds  
  **Given** the benchmark summary logged per IT-001  
  **When** `bench-compare --skill plan-it` is run  
  **Then** the variant row shows `behave_pass_rate` within 0.05 of champion and `f1` within 0.05 of champion  
  Covers `FR-006`, `AC-005`.

### Smoke Tests

- `SMK-001`: Not applicable — no service deployment.

### End-to-End Tests

- `E2E-001`: Not applicable — the integration test covers the full validation path.

### Regression Tests

- `REG-001`: Not applicable — champion promotion is blocked if thresholds are not met.

### Performance Tests

- `PT-001`: Not applicable — latency is not a constraint for this refactor.

### Security Tests

- `ST-001`: Not applicable.

### Usability Tests

- `UX-001`: Not applicable.

### Observability Tests

- `OT-001`: Not applicable — MLflow logging is covered by IT-001.

## Definition of Done

- `skills/plan-it-lean/` exists as a full copy of `skills/plan-it/` with exactly four targeted edits applied.
- All four ACs (AC-001 through AC-004) verified by file diff.
- Benchmark run completed (`IT-001`); MLflow summary logged with variant hash.
- `bench-compare` output confirms thresholds met (`AC-005`).
- If thresholds met: variant promoted as champion and `skills/plan-it/` updated to match `skills/plan-it-lean/`; variant directory removed.
- If thresholds not met: implementation summary documents which metric regressed and by how much; no promotion; changes are not merged back.
- Required telemetry is implemented and verified.
- Required ADRs are updated from `Proposed` to `Accepted` or left with explicit open questions.
