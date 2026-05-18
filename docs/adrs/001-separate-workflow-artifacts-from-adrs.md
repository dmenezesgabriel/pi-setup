# ADR 001: Separate workflow artifacts from ADRs using a `tasks/` parent folder

## Status

Accepted

## Date

2026-05-17

## Related Tasks

- `tasks/issues/018-group-workflow-outputs-under-tasks-folder.md`

## Context

Three skills (plan-it, implement-it, review-it) write output files to the target repository. Before this decision, each skill wrote to its own root-level folder:

- `issues/` — task definition files (plan-it)
- `implementation/` — implementation summaries (implement-it)
- `reviews/` — review reports (review-it)

These three folder types form a single numbered lifecycle — a task defined in `issues/001-slug.md` produces `implementation/001-slug-summary.md` and `reviews/001-slug-review.md`. Writing them at the root level both clutters the repository root and obscures the lifecycle relationship between the folders.

ADRs (`docs/adrs/`) were already under `docs/` and are a different kind of artifact: they are long-lived architectural records that outlive individual task cycles, are referenced across the codebase, and are consumed independently of the plan/implement/review workflow.

## Decision

- Group workflow artifacts (`issues/`, `implementation/`, `reviews/`) under a shared `tasks/` parent: `tasks/issues/`, `tasks/implementation/`, `tasks/reviews/`.
- Leave ADRs at `docs/adrs/` — they are architectural records, not workflow artifacts.
- Leave `CONTEXT.md` at the project root — it is a shared vocabulary file consumed by all skills and humans alike.
- Leave `issues-lock.json` at the project root — it is a counter file, not an artifact.

## Options Considered

1. Group `issues/`, `implementation/`, `reviews/` under `tasks/`; keep `docs/adrs/` unchanged. `(recommended)`
2. Group all four under `tasks/` (including `tasks/adrs/`).
3. Keep all four at the root level (status quo).
4. Group under `.ai/` (hidden dotfolder convention).

## Consequences

Positive:
- Repository root stays clean — three folders collapse to one.
- The lifecycle relationship between issues, implementation summaries, and reviews is made explicit by the shared parent.
- ADRs remain discoverable at `docs/adrs/`, consistent with common open-source conventions (e.g., Markdown ADR).
- Easy to gitignore workflow artifacts (`tasks/`) without affecting architectural documentation (`docs/adrs/`).

Negative:
- All existing repositories that used the old flat paths must manually move their files to the new structure (or override the default paths with script arguments).
- Internal cross-references inside existing output files (e.g., `issue:` frontmatter pointing to `issues/001-slug.md`) will be stale until updated.

## Validation

- After implementing issue 018, run the four `ensure-*.sh` scripts with no arguments and verify they create `tasks/issues/`, `tasks/implementation/`, and `tasks/reviews/`.
- Read all updated SKILL.md, reference, and template files and confirm no `issues/`, `implementation/`, or `reviews/` path remains at root level.
- Confirm `docs/adrs/` appears unchanged in all files.

## Open Questions

- Should the skill scripts detect an existing flat-path layout and emit a migration warning? (Not required for this task — can be addressed in a follow-up.)
