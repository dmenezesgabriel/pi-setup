export function configureFromEnv(env: Record<string, any>) {
  const MLFLOW_TRACKING_URI = env.MLFLOW_TRACKING_URI || 'http://localhost:5000';
  const MLFLOW_EXPERIMENT_ID = env.MLFLOW_EXPERIMENT_ID || env.MLFLOW_EXPERIMENT;
  const OTLP_ENDPOINT =
    env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || MLFLOW_TRACKING_URI.replace(/\/$/, '') + '/v1/traces';

  const headersRaw = env.OTEL_EXPORTER_OTLP_TRACES_HEADERS || env.OTEL_EXPORTER_OTLP_HEADERS || null;
  const headers: Record<string, string> = {};
  if (MLFLOW_EXPERIMENT_ID) headers['x-mlflow-experiment-id'] = String(MLFLOW_EXPERIMENT_ID);
  return {
    mlflowTrackingUri: MLFLOW_TRACKING_URI,
    mlflowExperimentId: MLFLOW_EXPERIMENT_ID,
    otlpEndpoint: OTLP_ENDPOINT,
    otlpHeaders: headers,
  };
}
