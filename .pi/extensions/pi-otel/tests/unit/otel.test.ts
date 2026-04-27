import { describe, it, expect, vi, beforeEach } from 'vitest';

// mocks must be declared before importing module under test
vi.mock('@opentelemetry/sdk-node', () => {
  return {
    NodeSDK: class {
      public opts: any;
      public started = false;
      public shutdownCalled = false;
      constructor(opts: any) {
        this.opts = opts;
      }
      async start() {
        this.started = true;
      }
      async shutdown() {
        this.shutdownCalled = true;
      }
    },
  };
});

let lastExporterOpts: any = null;
vi.mock('@opentelemetry/exporter-trace-otlp-proto', () => ({
  OTLPTraceExporter: class {
    public opts: any;
    constructor(opts: any) {
      this.opts = opts;
      lastExporterOpts = opts;
    }
  },
}));

vi.mock('@opentelemetry/resources', () => ({
  Resource: class {
    private attrs: any;
    constructor(attrs: any) {
      this.attrs = attrs;
    }
  },
}));

// now import module under test
import { createSdk, shutdownSdk } from '../../src/core/otel';

describe('otel', () => {
  beforeEach(() => {
    lastExporterOpts = null;
  });

  it('createSdk starts NodeSDK and returns tracer', async () => {
    const cfg: any = { otlpEndpoint: 'http://localhost/v1/traces', otlpHeaders: { a: 'b' }, mlflowExperimentId: '1', mlflowTrackingUri: 'http://localhost' };
    const { sdk, tracer } = await createSdk(cfg as any);
    expect(sdk).toBeDefined();
    // NodeSDK mock sets started flag in start()
    expect((sdk as any).started).toBe(true);
    // tracer should be defined
    expect(tracer).toBeDefined();
    // exporter must have been constructed with url and headers matching cfg
    expect(lastExporterOpts).toBeDefined();
    expect(lastExporterOpts.url).toBe(cfg.otlpEndpoint);
    expect(lastExporterOpts.headers).toEqual(cfg.otlpHeaders);

    // shutdown should not throw
    await shutdownSdk(sdk as any);
    expect((sdk as any).shutdownCalled).toBe(true);
  });
});
