import { describe, it, expect } from 'vitest';
import mlflowAdapter from '../../src/adapters/mlflow';

describe('mlflow adapter config', () => {
  it('returns defaults when env empty', () => {
    const cfg = mlflowAdapter.configureFromEnv({});
    expect(cfg).toBeDefined();
    expect(cfg.mlflowTrackingUri).toBe('http://localhost:5000');
    expect(cfg.otlpEndpoint).toBe('http://localhost:5000/v1/traces');
  });

  it('respects MLFLOW_TRACKING_URI and MLFLOW_EXPERIMENT_ID', () => {
    const env = { MLFLOW_TRACKING_URI: 'http://mlflow:5000', MLFLOW_EXPERIMENT_ID: '42' };
    const cfg = mlflowAdapter.configureFromEnv(env as any);
    expect(cfg.mlflowTrackingUri).toBe('http://mlflow:5000');
    expect(cfg.mlflowExperimentId).toBe('42');
    expect(cfg.otlpHeaders).toHaveProperty('x-mlflow-experiment-id', '42');
  });

  it('respects explicit OTEL_EXPORTER_OTLP_TRACES_ENDPOINT', () => {
    const env = { MLFLOW_TRACKING_URI: 'http://mlflow:5000', OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: 'http://custom:4317/v1/traces' };
    const cfg = mlflowAdapter.configureFromEnv(env as any);
    expect(cfg.otlpEndpoint).toBe('http://custom:4317/v1/traces');
  });
});
