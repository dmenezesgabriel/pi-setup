import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import { createSdk, shutdownSdk } from './otel';
import { createTracingHandlers } from './core/handlers';
import { parseHeaders } from './utils';
import type { ExtensionConfig } from './types';
import { loadAdapter } from './adapters/loader';

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
  // defensive wrapper so handler exceptions don't crash the host
  function wrap<T extends (...args: any[]) => any>(fn: T) {
    return async function wrapped(...args: any[]) {
      try {
        // support handlers that return promise or not
        const res = fn(...args);
        if (res && typeof res.then === 'function') await res;
      } catch (err) {
        try {
          pi.logger?.error?.('pi-otel-mlflow handler error', String(err));
        } catch (e) {
          // ignore logging failures
        }
      }
    } as T;
  }

  pi.on('turn_start', wrap(handlers.onTurnStart));
  pi.on('before_provider_request', wrap(handlers.onBeforeProviderRequest));
  pi.on('after_provider_response', wrap(handlers.onAfterProviderResponse));
  pi.on('tool_call', wrap(handlers.onToolCall));
  pi.on('tool_result', wrap(handlers.onToolResult));
  pi.on('message_end', wrap(handlers.onMessageEnd));
  pi.on('turn_end', wrap(handlers.onTurnEnd));
  pi.on('session_shutdown', wrap(handlers.onSessionShutdown));

  if (handlers.registerCommand) handlers.registerCommand(pi);
}

export default async function (pi: ExtensionAPI) {
  // Load adapter (mlflow by default) and get adapter-specific config
  const adapter = await loadAdapter();
  const adapterConfig = adapter?.configureFromEnv?.(process.env) ?? buildConfigFromEnv();

  const { sdk, tracer } = await createSdk({
    otlpEndpoint: adapterConfig.otlpEndpoint,
    mlflowExperimentId: adapterConfig.mlflowExperimentId,
    mlflowTrackingUri: adapterConfig.mlflowTrackingUri,
    otlpHeaders: adapterConfig.otlpHeaders,
  });

  const handlers = createTracingHandlers(tracer as any, adapterConfig as any, adapter as any);

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
