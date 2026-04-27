# pi-otel-otel-adapters (pi-otel-mlflow compatibility)

This extension instruments pi events with OpenTelemetry and exports traces using a pluggable adapter model.
It is fully backwards-compatible with the previous `pi-otel-mlflow` behavior while allowing other adapters (Grafana/Tempo/etc.) to be added.

Key goals:

- Core OpenTelemetry instrumentation is adapter-agnostic.
- Platform-specific concerns (MLflow REST API, headers, experiments) live in an adapter.
- Backwards compatibility: the default adapter is `mlflow`, so existing setups keep working.

Folder layout (high level)

- src/core/\*\* — Core instrumentation, handlers, utilities and types (platform-agnostic)
- src/adapters/\*\* — Adapters for specific backends (mlflow, grafana, ...)
  - src/adapters/mlflow — MLflow adapter (traces fetchers, config parsing)
  - src/adapters/grafana — placeholder adapter demonstrating pluggability
- src/\*\* — compatibility entrypoints (re-exports) so consumers of old paths keep working

Quick start

1. Install deps

   cd extensions/pi-otel-mlflow
   npm install

2. Configure adapter & backend

- Default (MLflow - backwards compatible)

  export MLFLOW_TRACKING_URI=http://localhost:5000
  export MLFLOW_EXPERIMENT_ID=<your-experiment-id>

  # optional: explicit OTLP endpoint

  export OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=${MLFLOW_TRACKING_URI}/v1/traces

- Select a different adapter (e.g., grafana)

  export OTEL_ADAPTER=grafana

  # provide adapter-specific env vars (see adapter README or source)

3. Run pi and load extension

   pi -e /path/to/extensions/pi-otel-mlflow/index.ts

Commands

- /traces — lists recent traces (adapter-specific implementation)
- /traces show <traceId> — show trace details (adapter-specific)

Testing & quality

- Unit tests are implemented with Vitest. Run:

  npm run test:unit

- Mutation testing (StrykerJS) is supported via `stryker.conf.json` and a package script `npm run test:mutation`.
  To run mutation tests install the Stryker packages (dev dependency) and run the script:

  npm i --save-dev @stryker-mutator/core @stryker-mutator/vitest-runner
  npm run test:mutation

  NOTE: Stryker requires additional setup in CI and may take significant time; configuration is included but not executed by default.

Development notes

- The `src/core` folder contains the bulk of the instrumentation logic (handlers, otel startup/stop, utils). Keep this code adapter-agnostic.
- Adapter authors should implement the small Adapter interface in `src/adapters/types.ts` and provide:
  - configureFromEnv(env) → adapter config
  - createTraceCommandHandlers(config) → `listTraces` and `showTrace` handlers
  - createExporter(config) → optional exporter/headers for the OTLP exporter

Migration notes (from older pi-otel-mlflow)

- The public behavior is unchanged by default — the `mlflow` adapter is used if no OTEL_ADAPTER is set.
- Internal code has been reorganized to separate core vs adapter-specific logic. If you imported internal modules from this package, update imports to the new `src/core` paths.

If you want, I can:

- Run Stryker mutation tests and iterate to raise the mutation score (requires installing the Stryker packages),
- Implement additional adapters (Tempo/Loki) and CI integration,
- Harden concurrent span mapping and add redaction/sampling configuration.

Development

```sh
 export MLFLOW_TRACKING_URI=http://127.0.0.1:5000
 export MLFLOW_EXPERIMENT_ID=1
 export OTEL_EXPORTER_OTLP_TRACES_ENDPOINT="http://127.0.0.1:5000/v1/traces"
 export OTEL_EXPORTER_OTLP_TRACES_HEADERS="x-mlflow-experiment-id=1"
 pi -e ./index.ts
```

References

- [Mlflow Tracing](https://mlflow.org/docs/latest/genai/tracing/quickstart/)
- [Opentelemetry NodeJs](https://opentelemetry.io/docs/languages/js/getting-started/nodejs/)
