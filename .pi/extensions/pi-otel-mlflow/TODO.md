# pi-otel-mlflow — Refactor, Tests & TODO

Path: `.pi/extensions/pi-otel-mlflow/`


## Overview

This document captures a comprehensive analysis, refactor plan, testing strategy (AAA), and a prioritized TODO checklist to bring the `pi-otel-mlflow` extension to a more maintainable, testable and robust state.

It is based on a detailed inspection of the codebase and running the repository's unit tests, linter and formatter. The goal is to:
- Enforce Single Responsibility and Open/Closed principles
- Reduce cyclomatic complexity and duplication
- Improve test coverage for success / failure / edge cases
- Make handlers resilient and dependency-injectable for easier testing


---

## Code map (where logic lives)

- `src/index.ts` — extension entry (builds config from env, creates SDK, registers handlers, shuts down SDK)
- `src/otel.ts` — create & shutdown of OpenTelemetry NodeSDK and tracer
- `src/handlers.ts` — main handler factory: turn start/end, provider request/response, tool call/result, message_end, register command. Contains session/turn mapping and span attribute management.
- `src/traces.ts` — trace list/show command logic; remote calls to MLflow endpoints and formatting helpers
- `src/utils.ts` — helpers: parseHeaders, truncateText, normalizeSessionId, getPromptFromEvent, getOutputFromEvent, getMessageContent, generateId
- `src/types.ts` — ExtensionConfig, Handlers, SpanLike, TracerLike
- `tests/unit` — unit tests for utils and handlers
- `tests/integration/mlflow-otlp.test.ts` — optional integration test that uses an mlflow binary or an existing MLflow server (gated by RUN_INTEGRATION_TESTS)


---

## Functional requirements (extracted)

- Create a root span for each PI "turn" and attach session-related attributes.
- Create provider.request and provider.response spans for provider interactions, attaching model/provider/prompt/outputs and error status.
- Track token usage, stop reason, outputs, and set span status when errors occur.
- Create tool.* spans for tool calls and finalize them with details and error state.
- Persist and attach user input previews to root spans (mlflow.spanInputs) and assistant outputs (mlflow.spanOutputs).
- Expose a `traces` command to list and show traces from an MLflow tracking server.
- Send traces to an OTLP endpoint computed from env vars or MLflow tracking URI.
- Shutdown the OpenTelemetry SDK on session shutdown.


---

## Non-functional requirements (inferred)

- Resilience: handlers must not crash the extension; swallow non-fatal errors and continue.
- Testability: allow dependency injection (fetch, traces module) for deterministic tests.
- Maintainability: reduce duplication and complexity to enable easier future changes.
- Configurability: behavior controlled via environment variables (MLFLOW_TRACKING_URI, MLFLOW_EXPERIMENT_ID, OTEL_EXPORTER_OTLP_TRACES_ENDPOINT, OTEL_EXPORTER_OTLP_TRACES_HEADERS).
- Security: safe parsing of headers; do not leak secrets into logs.


---

## Dependency policy — minimal, vetted dependencies

To reduce risk and maintenance surface the project should rely on the minimum set of external packages. When a library is required prefer well-known, actively maintained, secure and widely-used packages. Avoid adding dependencies for small utility features that can be implemented safely with the standard library or minimal code.

Guidelines:
- Prefer Node.js built-ins and language features first (global fetch in Node 18+, URL, http/https, fs, child_process, crypto, etc.).
- For HTTP in runtime code, prefer the global fetch API (Node >=18). If a polyfill is required, prefer `undici` (recommended and maintained by the Node team) or `node-fetch` only as a fallback. Add a polyfill only when absolutely necessary.
- For testing and mocking use devDependencies only: `vitest` (already present) is acceptable. Avoid adding heavy test helper libraries unless strictly necessary; prefer simple injected stubs and small helpers.
- For OpenTelemetry rely on the official `@opentelemetry/*` packages (already present).
- For unique ids, `uuid` is acceptable (already used). Do not introduce alternative id libraries without justification.
- Avoid bringing utility monoliths like `lodash` unless multiple utilities are required; prefer small, explicit helpers implemented in-house.
- For date utilities prefer `date-fns` or `dayjs` only if advanced date handling is needed; otherwise use the native `Date` API.
- For child process handling prefer Node's `child_process` or `execa` (dev-dependency already used for integration tests).
- For HTTP fetch mocking in tests, prefer dependency injection of a `fetchFn` or setting `globalThis.fetch` in test setup rather than adding a separate mock library.

Audit & policy enforcement actions:
- Add a task to audit `package.json` and remove unused runtime dependencies (see TODO list below).
- When proposing new dependencies, add a short justification and include links to the package repo/npm and recent activity (last commit, downloads).

---

## What I ran (commands & results)

Note: tests & commands were executed from: `.pi/extensions/pi-otel-mlflow`

- Unit tests (vitest)
  - Command used (dev environment): `./node_modules/.bin/vitest --run --reporter verbose`
  - Result: Unit tests passed. Summary:
    - Test Files: 2 passed | 1 skipped
    - Tests: 8 passed | 1 skipped

- Lint
  - Command: `npm run lint`
  - Result: No errors, but 6 complexity warnings (functions exceeding configured complexity):
    - `src/handlers.ts` (createProviderRequestSpan, onMessageEnd, finalizeTurn)
    - `src/traces.ts` (formatSpanEntry, listTraces, showTrace)
  - Log available in: `/tmp/pi-otel-lint.log` (local run)

- Prettier formatting
  - Command: `npm run format`
  - Result: Prettier formatted `src/handlers.ts`, `src/traces.ts`, `src/utils.ts`.
  - After formatting `npm run format:check` reported success.

- Known problem with package.json test scripts
  - `package.json` defines `test:unit` as `vitest --run --include src --include tests/unit` which caused an error in some vitest versions: `CACError: Unknown option '--include'`.
  - Workaround: invoke vitest binary directly with a working path or adjust scripts.


---

## Issues discovered (actionable)

1. Duplicate trace-formatting & trace-id parsing code is present in both `handlers.ts` and `traces.ts` (violates DRY).
2. High cyclomatic complexity in several functions (eslint warnings). These functions are good candidates for splitting into smaller functions.
3. `fetch` usage is inline across modules — make it injectable / abstract to ease testing and mocking.
4. Package `test:unit` script uses flags unsupported by some vitest versions — fix scripts for portability.
5. Many `any` types across handlers and context — improving typing will help with refactors and reduce mistakes.
6. Handlers assume existence of ctx fields like `sessionManager`, `ui` — code should be defensive.


---

## Refactor plan (SRP & Open/Closed)

Goal: partition the responsibilities, reduce complexity, and enable extension via dependency injection.

High-level plan (ordered, small to large):

A) Extract trace formatting helpers
- New file: `src/trace-format.ts`
- Move: getTraceInfo, getTraceId, getTraceTimestamp, getTraceDuration, getRequestPreview, formatTraceLine, formatSpanEntry
- Replace duplicates in `handlers.ts` and `traces.ts` with imports.

B) Centralize HTTP fetch logic and make it injectable
- New file: `src/fetcher.ts` with `type FetchFn = (url: string, body: any) => Promise<any>` and a `defaultFetch` using global `fetch`.
- Make `listTraces`, `showTrace`, and any handler fetch calls accept an optional `fetchFn` via config or dependency injection.

C) Split `handlers.ts` into focused modules
- Proposed modules:
  - `src/handlers/session.ts` — session / turn ID mapping utilities
  - `src/handlers/root.ts` — root span creation and finalize logic
  - `src/handlers/provider.ts` — provider request/response handlers
  - `src/handlers/message.ts` — message_end logic (user & assistant)
  - `src/handlers/tool.ts` — tool call/result handlers
  - `src/handlers/index.ts` — assembles all sub-handlers and exports `createTracingHandlers`
- Rationale: each module has a single responsibility and is easier to test.

D) Add a defensive handler wrapper
- Implement `wrapHandler(handlerFn, logger?)` to catch errors, call `pi.logger?.error` if provided, and avoid crashing.
- Use it when registering handlers with the extension.

E) Improve typings
- Expand `src/types.ts` with minimal `Context` interface (sessionManager, ui methods, cwd) and typed `Event` shapes where useful.

F) Make `traces` command plugin-friendly
- `createTracesHandler(config, fetchFn?)` so tests can inject a fake fetch and we can test all code paths deterministically.

G) Preserve existing tests and expand
- Maintain compatibility with unit tests while adding new tests for smaller modules.

Why this satisfies SRP/OCP
- Smaller focused modules == Single Responsibility.
- Dependency injection (fetch, traces module) makes new behavior possible without modifying core (Open/Closed).


---

## Testing plan (Triple-A: Arrange, Act, Assert)

Testing approach:
- Use a `FakeTracer` + `FakeSpan` classes (already present in unit tests) to verify spans created and attributes set.
- Inject fake `fetchFn` and fake `ctx` (sessionManager, ui) for deterministic tests.
- Test both success and failure/edge cases: events missing fields, span.setAttribute throwing, unknown ids, no UI available.

Detailed unit tests to add/expand (examples):

1) Session & turn mapping
- Arrange: ctx.sessionManager.getSessionFile returns path
- Act: call onTurnStart
- Assert: tracer started `pi.turn`, attributes include `mlflow.trace.session` and `session.id`
- Edge: missing sessionManager -> uses 'ephemeral' and no throw

2) Provider request/response
- onBeforeProviderRequest: starts provider span, sets model/provider and mlflow.spanInputs
- onAfterProviderResponse: sets token usage, outputs, error status if present, and ends span
- Edge: no providerEventId -> no-op; span methods throwing should be swallowed

3) Message handling
- user messages: store preview in messageIdToUserText and set root mlflow.spanInputs
- assistant messages: create provider.response span with outputs and set parent inputs when parentId exists

4) Tool handling
- onToolCall: start tool span with tool.name and args
- onToolResult: set status and details and end span; handle event.isError

5) onTurnEnd
- finalize root attributes from assistant message and parent id; ensure root ended and maps cleared
- Edge: root.end throws -> mapping still cleared and no crash

6) traces.ts
- listTraces: mock fetchFn -> return traces array -> ctx.ui.setWidget called
- showTrace: mock fetchFn -> returns a trace with spans -> ctx.ui.custom called
- Negative: fetch returns no traces -> ctx.ui.notify called with appropriate message
- Negative: fetch throws -> handler catches and notifies

7) utils tests (expand)
- parseHeaders with weird input, duplicate keys
- getOutputFromEvent with nested objects and arrays
- getMessageContent with content arrays and mixed shape

Test pattern (AAA):
- Arrange: create tracer, handlers, ctx with fakes
- Act: call handler
- Assert: check tracer.started, span.attrs, ctx.ui calls

Integration tests: keep existing integration test
- It is gated behind `RUN_INTEGRATION_TESTS=1`. CI should not run it by default; provide instructions for developers to run locally.


---

## Detailed TODO checklist (prioritized)

Immediate / High priority

- [x] Audit external dependencies and minimize runtime dependencies
  - Files: `package.json`
  - Change: Remove unused runtime dependencies, move test/dev-only packages to `devDependencies`, and avoid adding new runtime packages unless there is a strong, justified need. Prefer native APIs and small focused libraries (see "Dependency policy").
  - Acceptance: `package.json` contains only required runtime dependencies; CI installs and tests run reliably; any requested new runtime dependency includes a justification and security/maintenance check.
  - Notes: Audit completed. Current runtime dependencies appear minimal and appropriate: `@opentelemetry/*` packages and `uuid`. Dev dependencies (vitest, eslint, prettier, execa, get-port) are correctly in `devDependencies`.
  - Estimate: Small (0.5-1h)

- [x] Fix `package.json` test scripts for portability
  - Files: `package.json`
  - Change: Replaced `--include` usage with explicit paths (updated `test:unit` to `vitest --run tests/unit` and `test:integration` to `RUN_INTEGRATION_TESTS=1 vitest --run tests/integration`).
  - Acceptance: `npm run test:unit` runs successfully; `npm test` works reliably on dev machines and CI.
  - Notes: Completed and committed.
  - Estimate: Small (0.5-1h)

- [x] Extract trace-format helpers to `src/trace-format.ts`
  - Files: `src/trace-format.ts`, updated imports in `src/handlers.ts` and `src/traces.ts`
  - Acceptance: no change in behavior; tests still pass.
  - Notes: Completed. Duplicate formatting code removed from both `handlers.ts` and `traces.ts` and centralized into `src/trace-format.ts`.
  - Estimate: Medium (1-2h)

- [x] Add `src/fetcher.ts` with injectable `FetchFn` and replace inline fetch usage in `src/traces.ts` (and other modules later)
  - Files: `src/fetcher.ts`, updated `src/traces.ts` to use the fetcher
  - Acceptance: tests can mock fetch; existing behavior preserved when using defaultFetch.
  - Notes: Completed. `traces.ts` now uses `defaultFetch` with optional `fetchFn` injection.
  - Estimate: Medium (1-2h)

- [x] Run `npm run format` and commit formatting changes
  - Files: `src/*` (already applied during analysis)
  - Acceptance: `npm run format:check` passes
  - Notes: Completed. Prettier formatting applied; `format:check` passes.
  - Estimate: Small (0.5h)


## Fixes implemented (summary)
- Centralized trace-format helpers into `src/trace-format.ts` and removed duplicate logic.
- Added `src/fetcher.ts` to encapsulate POST JSON fetch and made it injectable in `traces.ts`.
- Fixed TypeScript compilation errors by:
  - Adding a minimal ambient declaration for `@mariozechner/pi-coding-agent` (`src/pi-coding-agent.d.ts`).
  - Adapting `src/otel.ts` to wrap the OTLP exporter with an adapter implementing the SpanExporter interface.
  - Replacing use of `SemanticResourceAttributes` with a direct `service.name` resource attribute for compatibility.
- Fixed test import (execa) in `tests/integration/mlflow-otlp.test.ts`.
- Made handler registration defensive (wrapped handlers in `src/index.ts` to log and swallow errors).
- Resolved ESLint cyclomatic complexity warnings by refactoring complex functions in `src/handlers.ts` into smaller helpers.
- Removed duplicate/unused trace rendering helpers from `src/handlers.ts` that were replaced by `src/traces.ts`.

All changes were validated with unit tests and lint/format checks.


Medium priority (refactor & tests)

- [x] Split `src/handlers.ts` into focused modules (partial)
  - Files: `src/handlers/session.ts` added; session helper logic extracted and wired into `src/handlers.ts`.
  - Acceptance: `createTracingHandlers` still exports same public API; unit tests pass; complexity warnings improved.
  - Notes: This is an incremental refactor — remaining modules (root, provider, message, tool) are planned to be extracted in subsequent steps to further reduce complexity and increase testability.
  - Estimate: Large (2-4 days)

- [x] Add defensive `wrapHandler` to catch handler errors and log via `pi.logger`
  - Files: `src/index.ts` (implemented inline in `registerHandlersWithPi`)
  - Acceptance: thrown errors inside handlers do not crash extension and are logged if `pi.logger` available
  - Notes: Implemented a defensive `wrap` inside `registerHandlersWithPi` that wraps each handler. Unit tests pass.
  - Estimate: Medium (1-2h)

- [ ] Improve typing in `src/types.ts` and reduce `any` usage in handlers
  - Files: `src/types.ts`, updates across handler modules
  - Acceptance: compile-time type safety improved; tests updated and pass
  - Estimate: Medium (1-2 days)

- [ ] Add and expand unit tests to cover positive, negative and edge paths described above
  - Files: `tests/unit/*` additions and new test suites for each handler module
  - Acceptance: tests cover success/failure/edge cases; high confidence in behavior
  - Estimate: Large (2-4 days)


Longer-term / Nice to have

- [ ] Add GitHub Actions CI to run formatting, lint and unit tests
  - Files: `.github/workflows/ci.yml`
  - Acceptance: PRs automatically validated
  - Estimate: Medium (1 day)

- [ ] Document local integration test workflow and env variables in `README.md`
  - Files: `README.md`
  - Acceptance: devs can run the integration test locally using installed `mlflow` and `python3`
  - Estimate: Small (1h)

- [ ] Extend runtime diagnostics / telemetry for the extension itself
  - Files: new `src/diagnostics.ts` or similar
  - Acceptance: extension logs errors as traces or special events when enabled
  - Estimate: Large (2-5 days)


---

## Suggested immediate next step

1. I can implement the small, low-risk items now:
   - Fix the `package.json` test script (done)
   - Create `src/trace-format.ts` and update both usages (done)
   - Add `src/fetcher.ts` and wire it into `src/traces.ts` (done)

Pick one or more and I will implement them in small commits with tests and explanatory commit messages.

---

## Remaining tasks (detailed) — do not ignore lint / type errors; fix them properly

Note: the following tasks remain and will be implemented without disabling or suppressing any linting or type warnings. Each task includes acceptance criteria and rough estimate.

### Must do — correctness, typing and test coverage

- [x] Add unit tests for `src/traces.ts` (listTraces, showTrace, createTracesHandler)
  - Reason: no unit tests previously for traces; important to validate different server responses and UI behavior
  - Tests added (AAA pattern):
    - success: fetchFn returns traces array -> ctx.ui.setWidget called with formatted lines
    - no-results: fetchFn returns empty array -> ctx.ui.notify called with 'No traces returned'
    - showTrace: fetchFn returns one trace with spans -> ctx.ui.custom called with trace text
    - error: fetchFn throws -> ctx.ui.notify called with error message (handled by caller)
  - Acceptance: tests added and passing.
  - Estimate: Medium (3-5h)

- [x] Add unit tests for `src/handlers.ts` behaviors not covered
  - Targets and scenarios covered by new tests:
    - onAfterProviderResponse: tokenUsage, stopReason, outputs applied and span.end invoked; error status applied
    - onToolCall/onToolResult: create tool span with args; finalizeToolSpan sets tool.details and error status when event.isError
    - onTurnEnd: finalizeTurn applies assistant outputs and parent inputs, root.end invoked and mappings cleared
    - registerCommand: ensures command registration
    - Edge cases: missing ctx.ui handled; span methods failing are swallowed
  - Approach: FakeTracer and FakeSpan used to simulate behavior
  - Acceptance: tests added and passing
  - Estimate: Large (1-2 days)

- [x] Add unit tests for `src/otel.ts` (createSdk, shutdownSdk)
  - Approach: mocked OTLPTraceExporter and NodeSDK behavior to avoid network; createSdk returns sdk and tracer, shutdownSdk calls sdk.shutdown
  - Acceptance: tests added and passing
  - Estimate: Medium (3-4h)

- [x] Add unit tests for `src/fetcher.ts` (defaultFetch)
  - Scenarios covered: fetch returns ok json; fetch returns non-ok -> throws; fetch rejects -> throws
  - Acceptance: tests added and passing
  - Estimate: Small (1-2h)

- [x] Add unit tests for `src/trace-format.ts` helpers
  - Scenarios covered: formatSpanEntry handles various span shapes, timestamps formatted
  - Acceptance: tests added and passing
  - Estimate: Small (1-2h)

- [x] Add coverage reporting to the project
  - Action: added `@vitest/coverage-v8` as a devDependency and configured `vitest.config.ts` to use the v8 provider. Ran tests with coverage to produce reports.
  - Rationale: generate coverage report to identify untested functions and guide tests additions
  - Acceptance: `vitest --coverage` produces text summary and an `lcov` file in `coverage/` directory
  - Estimate: Small (0.5-1h)

### Should do — refactor & maintainability

- [ ] Incrementally split `src/handlers.ts` into smaller modules (session, root, provider, message, tool)
  - Approach: extract one module at a time and update tests for that module. Keep createTracingHandlers as composer.
  - Acceptance: no behavior change; lint complexity warnings resolved; unit tests kept green
  - Estimate: Large (2-4 days)

- [ ] Improve typings across the codebase
  - Files: `src/types.ts`, and use these types across the handlers/traces/utils so `any` usage is minimized
  - Acceptance: stricter typing, fewer `any` occurrences, tests updated accordingly
  - Estimate: Medium (2 days)

- [ ] Add a defensive wrapper for handlers at registration (already implemented in `src/index.ts`)
  - Acceptance: tested (simulate handler throwing and ensure pi.logger.error called and extension remains alive)
  - Estimate: Completed

### Nice to have

- [ ] Add GitHub Actions CI to run lint/format/tests and coverage
  - Acceptance: PRs validated automatically
  - Estimate: Medium (1 day)

- [ ] Document integration test procedure for MLflow in README
  - Acceptance: clear instructions for developers to run integration tests locally with `mlflow` binary and `python3`
  - Estimate: Small (1h)

- [ ] Audit and remove any truly dead code
  - Action: run static analysis tools and review exports not used by runtime or tests; remove or mark exported helpers as public API
  - Acceptance: no runtime behavior change; tests updated/kept green
  - Estimate: Medium (2-4h)

---

## Next immediate steps I will take (pickable)
- [ ] Add unit tests for `src/traces.ts` (I can start now)
- [ ] Add unit tests for `src/handlers.ts` missing behaviors (I can begin after traces tests)
- [ ] Add `@vitest/coverage-v8` to devDependencies and enable coverage reporting

Tell me which task to start with. I will implement it in small commits, run tests/lint/tsc after each change, and update this TODO file marking items completed as I progress.


---

## Commands & how to run locally

From `.pi/extensions/pi-otel-mlflow`:

- Install deps: `npm ci`
- Run unit tests: `npm test` or (if `test` script calls vitest) `./node_modules/.bin/vitest --run tests/unit`
- Run lint: `npm run lint`
- Auto-fix lint where possible: `npm run lint:fix`
- Format: `npm run format` / check format: `npm run format:check`
- Integration test (dev-only): `RUN_INTEGRATION_TESTS=1 npm run test:integration` (needs `mlflow` binary or running MLflow server)

Tip: When running long operations locally, run inside `tmux` to avoid blocking your interactive session (as done in this analysis).


---

If you'd like I will now:
- create the small changes (package.json test scripts, trace-format extraction, fetcher) and commit them, OR
- start splitting handlers into smaller modules and add tests for each new module.

Which should I begin with?