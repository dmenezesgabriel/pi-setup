# pi-otel-mlflow

## Purpose

A pi extension that instruments pi events with OpenTelemetry and sends OTLP/HTTP traces directly to a local MLflow server (no Collector, no Docker). It also exposes a `/traces` command to query MLflow for recent traces and show compact summaries in the pi TUI.

## Design

- Uses OpenTelemetry Node SDK and OTLP/HTTP exporter to send traces to MLflow's /v1/traces ingestion endpoint.
- Tracks root spans per user turn and child spans for provider requests and tool calls.
- Registers a pi command `/traces` to list traces or show a trace summary (uses MLflow REST endpoints).

## Prerequisites

- Node.js (>=18) and npm
- pi installed
- MLflow server (Python) installed and running locally (no Docker required). See below.

## Start MLflow Server (local, SQLite)

1. Create a Python venv (optional) and install mlflow:

   python -m venv .venv
   source .venv/bin/activate
   pip install --upgrade pip
   pip install mlflow

2. Start MLflow server (defaults to port 5000):

   mlflow server --backend-store-uri sqlite:///mlflow.db --default-artifact-root ./mlflow-artifacts

3. Open MLflow UI at http://localhost:5000. Create an experiment named `pi-agents` (or any name) and note its experiment ID (you can create via UI or via Python).

## Extension setup

1. Install Node deps for the extension:

   cd extensions/pi-otel-mlflow
   npm install

2. Set environment variables (example):

   export MLFLOW_TRACKING_URI=http://localhost:5000
   export MLFLOW_EXPERIMENT_ID=<your-experiment-id>

   # optional: OTLP endpoint (defaults to $MLFLOW_TRACKING_URI/v1/traces)

   export OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=${MLFLOW_TRACKING_URI}/v1/traces

   # optional: extra headers (k=v,k2=v2)

   export OTEL_EXPORTER_OTLP_TRACES_HEADERS="x-my-header=val"

3. Start pi and load the extension (either symlink it to ~/.pi/agent/extensions or use -e):

   pi -e /path/to/extensions/pi-otel-mlflow/index.ts

## Usage inside pi

- After the extension is loaded, it will start an OpenTelemetry SDK and send spans for new turns/provider calls/tool calls.
- Use the command `/traces` in pi to list recent traces for the configured experiment (shows a widget with trace id / timestamp / preview).
- Use `/traces show <traceId>` to fetch a compact span listing for the trace from MLflow.

## Notes & limitations (PoC)

- This is a minimal proof-of-concept: it assumes a single active root span at a time (typical interactive use). For highly concurrent subagents, the span management should be strengthened.
- The extension posts to MLflow REST search endpoints at `/api/2.0/mlflow/traces/search` and `/api/2.0/mlflow/traces/batchGet`. If your MLflow server path differs, adjust the URLs in the extension.
- By default full prompt text is not specially redacted — add a span processor or modify the extension to redact/hide PII prior to export.

If you want, I can:

- Harden the span mapping for parallel tool execution (map event objects to spans robustly),
- Add configurable prompt redaction & sampling,
- Add a small helper Python script to create the experiment and return the ID automatically.

# References

- [Mlflow Tracing](https://mlflow.org/docs/latest/genai/tracing/quickstart/)
- [Opentelemetry NodeJs](https://opentelemetry.io/docs/languages/js/getting-started/nodejs/)
