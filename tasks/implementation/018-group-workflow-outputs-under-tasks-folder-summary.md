---
id: "018"
issue: "issues/018-group-workflow-outputs-under-tasks-folder.md"
created: 2026-05-17
updated: 2026-05-17
---

# Implementation Summary: Group workflow outputs under tasks/ folder

## Related Task

- `issues/018-group-workflow-outputs-under-tasks-folder.md`

## Files Changed

- `skills/plan-it/SKILL.md` — changed all `issues/` path examples to `tasks/issues/`
- `skills/plan-it/references/output-files.md` — changed `issues/` to `tasks/issues/` throughout; changed `issues/_archive` to `tasks/issues/_archive`
- `skills/plan-it/scripts/ensure-issues-dir.sh` — changed default `ISSUES_DIR` from `issues` to `tasks/issues`
- `skills/plan-it/scripts/next-issue-number.sh` — changed default `ISSUES_DIR` from `issues` to `tasks/issues` and `ARCHIVE_DIR` from `issues/_archive` to `tasks/issues/_archive`
- `skills/plan-it/assets/adr-template.md` — changed Related Tasks example from `issues/001-example-task.md` to `tasks/issues/001-example-task.md`
- `skills/implement-it/SKILL.md` — changed all `implementation/` path examples to `tasks/implementation/`
- `skills/implement-it/references/output-rules.md` — changed all `implementation/` path examples to `tasks/implementation/`
- `skills/implement-it/scripts/ensure-implementation-dir.sh` — changed default `IMPLEMENTATION_DIR` from `implementation` to `tasks/implementation`
- `skills/implement-it/assets/implementation-summary-template.md` — changed `issues/001-slug.md` to `tasks/issues/001-slug.md` and `issues/001-example-task.md` to `tasks/issues/001-example-task.md`
- `skills/review-it/SKILL.md` — changed all `reviews/` to `tasks/reviews/`, `issues/` to `tasks/issues/`, and `implementation/` to `tasks/implementation/`
- `skills/review-it/references/output-rules.md` — changed all `reviews/` path examples to `tasks/reviews/`
- `skills/review-it/references/review-rules.md` — changed all `issues/` path examples to `tasks/issues/` and `reviews/` path examples to `tasks/reviews/`
- `skills/review-it/scripts/ensure-reviews-dir.sh` — changed default `REVIEWS_DIR` from `reviews` to `tasks/reviews`
- `skills/review-it/assets/review-report-template.md` — changed `issues/NNN-slug.md` to `tasks/issues/NNN-slug.md` and `reviews/NNN-slug-review.md` to `tasks/reviews/NNN-slug-review.md`
- `docs/adrs/001-separate-workflow-artifacts-from-adrs.md` — updated Status from `Proposed` to `Accepted`

## Behavior Implemented

- plan-it now writes issue files to `tasks/issues/` by default (FR-001, FR-002).
- implement-it now writes implementation summaries to `tasks/implementation/` by default (FR-003).
- review-it now writes review reports to `tasks/reviews/` by default (FR-004).
- review-it searches `tasks/issues/` when no issue argument is given (FR-005).
- review-it reads the implementation summary from `tasks/implementation/` (FR-006).
- All path examples in templates reference the new `tasks/` paths (FR-007, FR-008).
- `docs/adrs/` paths are unchanged across all files (FR-009).
- Scripts continue to accept an optional DIR argument to override the default path (FR-010).

## Design Notes

- Purely mechanical path-substitution refactor — no new abstractions, helpers, or functionality introduced (NFR-002).
- All internal cross-references within each skill are consistent: SKILL.md, reference files, templates, and scripts all use the same canonical `tasks/` paths (NFR-001).
- `docs/adrs/` paths were not changed anywhere; the constraint was verified by inspection after each edit.
- Script argument-override behavior is preserved: the default value changes, the parameter handling does not.

## Tests Added or Updated

No test files were added or modified. The shell scripts were validated by direct invocation (see Validation Run below). This task changes only skill definition files (documentation and scripts) — no unit test framework applies.

## Test Categories Not Applicable

- `Unit`: Not applicable — these are bash scripts and markdown files; correctness is verified by running the scripts and reading the files.
- `Integration`: Not applicable — no integrated system behavior to test.
- `Smoke`: Not applicable — no service, deployment, or startup path involved.
- `E2E`: Not applicable — no user journey through a running application.
- `Regression`: Not applicable — no prior defect being fixed.
- `Performance`: Not applicable — script execution time is negligible.
- `Security`: Not applicable — no authentication, authorization, secrets, or trust boundaries involved.
- `Usability`: Not applicable — no UI.
- `Observability`: Not applicable — no logs, metrics, or traces.

## Validation Run

```text
bash skills/plan-it/scripts/ensure-issues-dir.sh (no args) — printed "ready: tasks/issues", created tasks/issues/
bash skills/implement-it/scripts/ensure-implementation-dir.sh (no args) — printed "ready: tasks/implementation", created tasks/implementation/
bash skills/review-it/scripts/ensure-reviews-dir.sh (no args) — printed "ready: tasks/reviews", created tasks/reviews/
bash skills/plan-it/scripts/next-issue-number.sh (no args) — returned "001", wrote issues-lock.json with {"next_id": 2}
```

All four unit tests (UT-001 through UT-004) pass.

## Accessibility Notes

Not applicable — this task does not change frontend UI.

## Observability Changes

Not applicable — this task changes only skill definition files.

## ADR Updates

- `docs/adrs/001-separate-workflow-artifacts-from-adrs.md` — updated from `Proposed` to `Accepted`.

## Unresolved Assumptions or Follow-Up

- Existing repositories that used the old flat paths (`issues/`, `implementation/`, `reviews/`) must manually move their files to the new structure, or override the default paths with script arguments. This migration is out of scope per the task definition.
- Internal cross-references in existing output files (e.g., `issue:` frontmatter pointing to `issues/001-slug.md`) will be stale until updated. Out of scope.
