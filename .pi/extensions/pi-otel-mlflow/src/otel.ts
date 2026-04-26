import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { trace } from '@opentelemetry/api';
import type { ExtensionConfig } from './types';

export async function createSdk(config: ExtensionConfig) {
  const headers = config.otlpHeaders ?? {};
  const exporter = new OTLPTraceExporter({ url: config.otlpEndpoint, headers });

  const sdk = new NodeSDK({
    traceExporter: exporter,
    resource: new Resource({ [SemanticResourceAttributes.SERVICE_NAME]: 'pi-coding-agent' }),
  });
  await sdk.start();
  const tracer = trace.getTracer('pi-otel-mlflow', '0.1.0');
  return { sdk, tracer };
}

export async function shutdownSdk(sdk: NodeSDK) {
  try {
    await sdk.shutdown();
  } catch (e) {
    // ignore
  }
}
