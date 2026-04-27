import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { Resource } from '@opentelemetry/resources';
import { trace } from '@opentelemetry/api';
import type { ExtensionConfig } from '../types';
import type { SpanExporter } from '@opentelemetry/sdk-trace-base';

class SpanExporterAdapter implements SpanExporter {
  private exporter: any;
  constructor(exporter: any) {
    this.exporter = exporter;
  }
  export(spans: any, resultCallback: any): void {
    if (typeof this.exporter.export === 'function') return this.exporter.export(spans, resultCallback);
    // fallback: caller's callback with failure
    resultCallback({ code: 1 });
  }
  shutdown(): Promise<void> {
    if (typeof this.exporter.shutdown === 'function') return this.exporter.shutdown();
    return Promise.resolve();
  }
}

export async function createSdk(config: ExtensionConfig) {
  const headers = config.otlpHeaders ?? {};
  const exporter = new OTLPTraceExporter({ url: config.otlpEndpoint, headers });

  const sdk = new NodeSDK({
    traceExporter: new SpanExporterAdapter(exporter) as any,
    resource: new Resource({ 'service.name': 'pi-coding-agent' }),
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
