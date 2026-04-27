# TODO: Refactor plan — decouple MLflow from OTEL extension (temporary task list)

Purpose: transform the current pi-otel-mlflow extension into a platform-agnostic OpenTelemetry extension while keeping full compatibility with MLflow (no feature loss). The refactor should:

- Separate platform-specific concerns (MLflow) from core OTEL instrumentation
- Expose a small adapter API so additional backends (Grafana/Tempo/Loki or others) can be plugged in
- Keep codebase simple and easy to maintain (balanced SRP & Open/Closed principles)
- Preserve all current features & tests; migrate tests to the new structure

Legend: [ ] TODO, [x] Done

[ x ] Comprehensive codebase reading and file-by-file analysis (initial discovery)
[ x ] Create this TODO file

Testing strategy (required)

- Use Test-Driven Development (TDD) for the refactor: write failing unit tests first, implement minimal changes to make them pass, refactor with tests as the safety net.
- Maintain AAA pattern (Arrange, Act, Assert) in all unit tests so tests are clear and easy to reason about.
- Use spies and mocks liberally for external interactions and to assert side effects (e.g., spy on tracer.startSpan, sdk.start/sdk.shutdown, and pi.registerCommand).
- Cover each function with tests for success, failure, and edge cases. Prioritize small, focused test cases per function.
- Add mutation testing (StrykerJS) integrated with the Vitest test runner to ensure test quality and to detect weak assertions. Include a Stryker configuration and a package script to run mutation tests.
- Aim for a high mutation score (configurable threshold, e.g. >= 85%). Fail the mutation check in CI if below threshold.

Phase 0 — Discovery & quick wins (TDD first)

- [x] Create test-first tasks for the smallest pieces: core/utils.ts and core/types.ts
  - [x] Write unit tests for each function in utils.ts (parseHeaders, truncateText, normalizeSessionId, getPromptFromEvent, getOutputFromEvent, generateId) following AAA, covering success, failure, and edge cases
  - [x] Implement/Move utils into src/core/utils.ts and export compatibility shims
  - [x] Write unit tests for core/types.ts (types are compile-time; runtime compatibility ensured via existing tests)
  - [x] Implement core/types.ts (moved types and re-exported for compatibility)
- [x] Add a lightweight adapter interface type (src/adapters/types.ts) describing expected adapter capabilities (exporter creation, traces command handlers). Create tests for loader behavior (unsupported adapter, default behavior).
- [x] Add tests for adapter loader behavior (use dependency injection / mocks to avoid runtime require/import of adapters)
- [x] Move MLflow-specific configuration & env parsing into a small module (src/adapters/mlflow/config.ts) — tests added to assert correct header building and fallbacks
- [x] Small rework: move traces.ts into src/adapters/mlflow/traces.ts and create tests for list/show functions (mock fetch responses and UI interactions)

Phase 1 — Core separation

- [x] Create core/agnostic modules (TDD each module before implementation):
  - [x] src/core/otel.ts — start/stop SDK, accept injected exporter/headers; remove direct MLflow env dependency. Tests mock NodeSDK and exporter behavior, assert start/stop semantics and header propagation.
  - [x] src/core/handlers.ts — keep event handling logic but remove direct references to MLflow REST; use adapter for traces/list/show. Port existing handlers.test.ts tests to the new core/handlers API first (rename imports) and enhance with spy-based assertions.
  - [x] src/core/types.ts — core types used by handlers and SDK (moved)
  - [x] src/core/utils.ts — keep existing utils (moved from src/utils.ts)
- [x] Implement adapter loader (src/adapters/loader.ts): load adapter by env var (e.g., OTEL_ADAPTER=mlflow) defaulting to `mlflow` for backwards compatibility. Unit tests for loader edge cases added.
- [x] Keep backward compatibility: still honor MLFLOW_* env vars but namespace MLflow-specific env parsing in adapter module. Tests ensure configuration fallbacks work as before.

Phase 2 — Adapter API & MLflow adapter

- [x] Define Adapter interface (typescript) with methods:
  - id: string
  - configureFromEnv(env): AdapterConfig
  - createTraceCommandHandlers(config): { listTraces(ctx), showTrace(id, ctx), tracesCommandHandler }
  - createExporter(config): SpanExporter | returns header map for core SDK to use
- [x] Implement MLflow adapter that keeps current traces logic (moved traces.ts), and provides exporter/header defaults used historically (x-mlflow-experiment-id header etc.). Tests validate behaviour: list trace success/failure, show trace success/not found.
- [x] Add small Grafana/Tempo placeholder adapters (optional) to demonstrate pluggability. Write tests proving loader picks them when OTEL_ADAPTER env var is set (Grafana and Tempo adapters added).

Phase 3 — Tests, mutation testing and migration

- [x] Update unit tests to reference new modules; create unit tests for adapter loader & MLflow adapter
- [x] Keep all existing handlers tests intact but point imports to new core handlers; minimize test rewrites by exporting compatibility entrypoints (index.ts forwarding)
- [x] Add StrykerJS configuration (stryker.conf.json) and package script (test:mutation). Installation & CI integration pending:
  - [x] Install & configure @stryker-mutator/core and the appropriate Vitest runner (installed and configured; Vitest upgraded to v2)
  - [x] Configure Stryker to only mutate src/ code, ignore tests, and set mutation score thresholds (via stryker.conf.json)
  - [x] Add package.json script: "test:mutation" to run Stryker
  - [ ] Add CI step (optional) to run mutation tests and fail on low score

  Note: I ran Stryker once (report at reports/mutation/mutation.html). The initial mutation score was 13.95% — this indicates tests need strengthening to kill many mutants; next step is to iterate on tests to raise the mutation score toward the target (>=85%).

- [ ] Run integration test and adjust to new layout

Phase 4 — Cleanup & docs

- [x] Update README to explain adapter model, env variables, how to add new adapters (include migration notes and how to run mutation tests)
- [x] Keep old index.ts default export (compatibility)
- [x] Add CHANGELOG with migration steps

Phase 5 — Future improvements (post-refactor)

- [ ] Add configurable prompt redaction & sampling
- [ ] Strengthen concurrency for span mapping (support concurrent turns/subagents)
- [ ] Add optional Collector support (OTLP/gRPC) and batching
- [ ] Add more adapters (Grafana/Tempo/Loki) and example configs

Cleanup tasks (duplicates & housekeeping)

- [ ] Decide whether to keep compatibility re-export shims (src/*.ts that forward to src/core or src/adapters) or remove them. Keeping them preserves backward compatibility; removing them reduces apparent duplication.
- [ ] If removing shims: update imports across tests and code to point at core/adapters (I can do this in a single, safe refactor pass).
- [x] Remove the duplicate type declaration in src/pi-coding-agent.d.ts (already fixed)
- [ ] Remove the unused devDependency @stryker-mutator/typescript from package.json (Stryker warns it is unused)
- [ ] Consider moving placeholder adapters (src/adapters/grafana, src/adapters/tempo) to src/adapters/examples/ or implement them fully. (Currently they exist as placeholders and are counted by Stryker as low-coverage).
- [ ] Fix the Vite dynamic import warning in src/adapters/loader.ts (use a safer resolution or include file extension / explicit map)
- [ ] Add .gitignore/cleanup for Stryker reports if you don't want them committed (reports/mutation/)
- [ ] Add CI step to run unit tests and optionally Stryker mutation tests (configurable threshold). (defer until mutation score is improved)

Testing checklist (applies to all phases)

- [x] Each new/changed function has a unit test written first (TDD) covering:
  - success case(s)
  - failure case(s) (throwing, invalid input, nulls)
  - edge cases (empty arrays, missing fields, large inputs)
- [x] Use Arrange / Act / Assert in all tests
- [x] Use spies/mocks for external systems (tracer, NodeSDK, fetch, pi API)
- [x] Keep tests deterministic and fast; prefer small focused unit tests and isolate network calls using mocks/stubs
- [ ] After unit tests pass, run StrykerJS and iterate until mutation score target is met

Risk analysis & mitigations

- Risk: breaking tests and usages. Mitigation: preserve current public behavior by providing compatibility shims and migrate tests incrementally. Use TDD to avoid regressions.
- Risk: API explosion / over-fragmentation. Mitigation: limit adapter surface and keep core logic centralized.

Estimated effort (rough):

- Phase 0: 1–2 days (TDD: write tests for utils & types first)
- Phase 1: 2–4 days
- Phase 2: 2–3 days
- Phase 3: 2–4 days (includes mutation testing iterations)
- Phase 4: 1 day
