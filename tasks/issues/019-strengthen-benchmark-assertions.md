---
id: "019"
created: 2026-05-19
updated: 2026-05-19
status: active
---

# Task: Strengthen behavioral assertions and establish champion baselines

## Priority

P0 — Must complete before any skill refactor task. Champion baselines require these assertions to be in place so quality regressions are detectable.

## Dependencies

- No task dependency — this is the first in the sequence.
- No ADR dependency — no architectural decisions involved.

## Assignability

**AFK** — all file paths, new scenario text, and step definition signatures are fully specified. No open decisions.

## Context

The current `plan-it.feature` and `implement-it.feature` Gherkin scenarios verify structural presence only: directories exist, files are named correctly, headings are non-empty. They cannot detect content quality drift.

If a skill change causes the agent to produce vague requirements (`Add project feature` instead of `FR-001: A signed-in user can create a project`), the current `behave_pass_rate` and `f1` metrics will not change. The `plan_evaluator` uses `section_present()` which returns `True` for any non-empty content below a heading.

This task adds deterministic content-quality assertions before any skill files are touched, so that subsequent refactor tasks have a reliable regression gate. It also promotes the current unmodified skills as the champion baseline in MLflow.

## Use Cases

- **Feature**: Benchmark quality gate
- **Scenario**: Refactored skill produces vague requirements
- **Given** a skill change removes inline examples from the task template
- **When** the benchmark runs with the new `FR-NNN:` format scenario
- **Then** the scenario fails for any trial that produced requirements without IDs, catching the regression before promotion

- **Feature**: Benchmark quality gate
- **Scenario**: Developer establishes baseline before refactoring
- **Given** champion baselines are promoted for plan-it and implement-it
- **When** a refactor variant is compared with `bench-compare`
- **Then** the table highlights the champion and shows the Δ against it

## Definition of Ready

- `benchmarks/features/plan-it.feature` is readable and has existing passing scenarios.
- `benchmarks/features/implement-it.feature` is readable and has existing passing scenarios.
- `benchmarks/features/steps/common_steps.py` has existing step definitions that can be extended.
- `pi` CLI is available and `openai-codex/gpt-5.4-mini` model is accessible.

## Functional Requirements

- `FR-001`: `common_steps.py` has a step `every file in "{pattern}" has content matching "{regex}"` that searches each matching file for the regex and fails with the list of non-matching filenames.
- `FR-002`: `common_steps.py` has a step `every file in "{pattern}" has frontmatter key "{key}" with value "{value}"` that checks the YAML frontmatter block of each file for the given key-value pair.
- `FR-003`: `plan-it.feature` has a scenario `Every issue file contains at least one properly formatted functional requirement` using `FR-\d{3}:` regex.
- `FR-004`: `plan-it.feature` has a scenario `Every issue file acceptance criteria contain observable Gherkin language` using the `contains any of "Given,When,Then"` step.
- `FR-005`: `plan-it.feature` has a scenario `Every issue file has active status in frontmatter` using the new frontmatter step.
- `FR-006`: `plan-it.feature` has a scenario `Every issue file contains test IDs linked to requirement IDs` using regex `Covers (FR|AC|NFR|OBS)-\d{3}`.
- `FR-007`: `implement-it.feature` has a scenario `Every summary has a non-empty Design Notes section` using the existing `contains non-empty section` step.
- `FR-008`: `implement-it.feature` has a scenario `Every summary documents ADR update status` using `contains any of "ADR Updates,Not applicable"`.
- `FR-009`: After the benchmark runs with the unmodified skills, `bench-promote` tags the current plan-it skill content hash as champion.
- `FR-010`: After the benchmark runs with the unmodified skills, `bench-promote` tags the current implement-it skill content hash as champion.

## Non-Functional Requirements

- `NFR-001`: New step definitions follow the existing style in `common_steps.py` — `behave` decorators, assertion messages include file names and workspace path, vacuous pass when no files match the glob.
- `NFR-002`: New Gherkin scenarios are grouped under a `# ── Content quality ──` comment block, consistent with existing grouping style in the feature files.
- `NFR-003`: The frontmatter step uses `re.MULTILINE` and matches `key:\s*value` without requiring exact whitespace, to handle both `status: active` and `status:active`.

## Observability Requirements

- `OBS-001`: Each benchmark run logs `behave_pass_rate`, `f1`, `quality_score`, and `input_tokens` to MLflow per trial.
- `OBS-002`: `bench-compare --skill plan-it` and `bench-compare --skill implement-it` display the promoted champion hash after promotion.

## Acceptance Criteria

- `AC-001`: **Given** a workspace containing an issue file with `FR-001: A signed-in user can create a project`, **When** the `FR-\d{3}:` scenario runs, **Then** it passes for that file.
- `AC-002`: **Given** a workspace containing an issue file with only `Add project feature` under Requirements (no FR ID), **When** the `FR-\d{3}:` scenario runs, **Then** it fails and names the offending file.
- `AC-003`: **Given** a workspace containing an issue file with `status: active` in its frontmatter, **When** the frontmatter scenario runs, **Then** it passes.
- `AC-004`: **Given** a workspace containing an issue file with `status: draft`, **When** the frontmatter scenario runs, **Then** it fails.
- `AC-005`: **Given** the benchmark runs 5 trials against the unmodified plan-it skill, **When** `bench-compare --skill plan-it` is run, **Then** all new scenarios appear in the `behave_scenarios` artifact and show `true` for trials that produced well-formed output.
- `AC-006`: **Given** champion promoted for plan-it and implement-it, **When** `bench-compare` is run for each, **Then** the champion row is highlighted with `★ champion`.

## Required Tests

### Unit Tests

- `UT-001`: Test `step_content_matches_regex` — assert passes when regex matches, fails with filename list when it does not. Covers `FR-001`.
- `UT-002`: Test `step_frontmatter_key_value` — assert passes for `status: active`, fails for `status: draft`, and fails when the key is absent. Covers `FR-002`.

### Integration Tests

- `IT-001`: **Scenario**: New plan-it scenarios pass against a known-good fixture  
  **Given** a workspace fixture with two well-formed issue files (FR IDs, Gherkin ACs, `status: active`, test linkage)  
  **When** `behave features/plan-it.feature --define workspace=<fixture>` runs  
  **Then** all new content-quality scenarios pass  
  Covers `FR-003`, `FR-004`, `FR-005`, `FR-006`.

- `IT-002`: **Scenario**: New plan-it scenarios fail against a known-bad fixture  
  **Given** a workspace fixture with one issue file missing FR IDs  
  **When** `behave features/plan-it.feature --define workspace=<fixture>` runs  
  **Then** the `FR-\d{3}:` scenario fails and identifies the bad file  
  Covers `FR-003`, `AC-002`.

- `IT-003`: **Scenario**: Champion baselines established end-to-end  
  **Given** the unmodified plan-it skill  
  **When** `uv run python run.py --skill plan-it --platform pi-agent --model openai-codex/gpt-5.4-mini --trials 5` completes  
  **Then** MLflow contains a summary run tagged with `skill_content_hash`  
  **And** `bench-promote --skill plan-it --content-hash <hash>` succeeds  
  Covers `FR-009`.

### Smoke Tests

- `SMK-001`: Not applicable — no deployment or service startup involved.

### End-to-End Tests

- `E2E-001`: Not applicable — the champion promotion is the integration test boundary.

### Regression Tests

- `REG-001`: Not applicable — no previous defect to guard against.

### Performance Tests

- `PT-001`: Not applicable — step definitions are regex checks on small files.

### Security Tests

- `ST-001`: Not applicable — no trust boundaries or authorization logic involved.

### Usability Tests

- `UX-001`: Not applicable — no user-facing UI.

### Observability Tests

- `OT-001`: Not applicable — benchmark telemetry is already tested via MLflow integration.

## Definition of Done

- `common_steps.py` has two new step definitions covered by `UT-001` and `UT-002`.
- `plan-it.feature` has four new content-quality scenarios passing `IT-001`.
- `implement-it.feature` has two new content-quality scenarios.
- Benchmark ran against unmodified plan-it and implement-it skills (5 trials each).
- `bench-promote` executed for both skills; `bench-compare` confirms `★ champion` for each.
- API contracts, user-facing behavior, ADRs, or operational runbooks are documented when changed.
