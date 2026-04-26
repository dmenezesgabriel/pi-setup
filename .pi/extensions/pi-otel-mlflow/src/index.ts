import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import { createSdk, shutdownSdk } from './otel';
import { createTracingHandlers } from './handlers';
import { parseHeaders } from './utils';
import type { ExtensionConfig } from './types';

function buildConfigFromEnv(): ExtensionConfig {
  const MLFLOW_TRACKING_URI = process.env.MLFLOW_TRACKING_URI || 'http://localhost:5000';
  const MLFLOW_EXPERIMENT_ID = process.env.MLFLOW_EXPERIMENT_ID || process.env.MLFLOW_EXPERIMENT;
  const OTLP_ENDPOINT =
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
    MLFLOW_TRACKING_URI.replace(/\/$/, '') + '/v1/traces';

  const envHeaders = parseHeaders(
    process.env.OTEL_EXPORTER_OTLP_TRACES_HEADERS || process.env.OTEL_EXPORTER_OTLP_HEADERS || null,
  );
  const headers = {
    ...(envHeaders ?? {}),
    ...(MLFLOW_EXPERIMENT_ID ? { 'x-mlflow-experiment-id': String(MLFLOW_EXPERIMENT_ID) } : {}),
  };

  return {
    mlflowTrackingUri: MLFLOW_TRACKING_URI,
    mlflowExperimentId: MLFLOW_EXPERIMENT_ID,
    otlpEndpoint: OTLP_ENDPOINT,
    otlpHeaders: headers,
  };
}

function registerHandlersWithPi(
  pi: ExtensionAPI,
  handlers: ReturnType<typeof createTracingHandlers>,
) {
  pi.on('turn_start', handlers.onTurnStart);
  pi.on('before_provider_request', handlers.onBeforeProviderRequest);
  pi.on('after_provider_response', handlers.onAfterProviderResponse);
  pi.on('tool_call', handlers.onToolCall);
  pi.on('tool_result', handlers.onToolResult);
  pi.on('message_end', handlers.onMessageEnd);
  pi.on('turn_end', handlers.onTurnEnd);
  pi.on('session_shutdown', handlers.onSessionShutdown);

  if (handlers.registerCommand) handlers.registerCommand(pi);
}

export default async function (pi: ExtensionAPI) {
  const config = buildConfigFromEnv();

  const { sdk, tracer } = await createSdk({
    otlpEndpoint: config.otlpEndpoint,
    mlflowExperimentId: config.mlflowExperimentId,
    mlflowTrackingUri: config.mlflowTrackingUri,
    otlpHeaders: config.otlpHeaders,
  });

  const handlers = createTracingHandlers(tracer as any, config);

  try {
    registerHandlersWithPi(pi, handlers as any);
    pi.logger?.info?.('pi-otel-mlflow: extension initialized');
  } catch (e) {
    pi.logger?.error?.('pi-otel-mlflow: failed to register handlers', String(e));
  }

  pi.on('session_shutdown', async () => {
    try {
      await shutdownSdk(sdk);
      pi.logger?.info?.('pi-otel-mlflow: OpenTelemetry SDK shut down');
    } catch (e) {
      // ignore
    }
  });
}
