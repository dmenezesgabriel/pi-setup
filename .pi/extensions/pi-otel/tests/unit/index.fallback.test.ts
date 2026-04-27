import { describe, it, expect, vi } from 'vitest';

// prepare mocks before importing the module under test
const fakeSdk: any = { shutdown: vi.fn() };
const fakeTracer: any = { startSpan: vi.fn() };

vi.mock('../../src/otel', () => ({
  createSdk: vi.fn(async (cfg: any) => ({ sdk: fakeSdk, tracer: fakeTracer })),
  shutdownSdk: vi.fn(async (s: any) => { if (s && s.shutdown) s.shutdownCalled = true; }),
}));

vi.mock('../../src/handlers', () => ({
  createTracingHandlers: vi.fn((_tracer: any, _config: any) => ({
    onTurnStart: vi.fn(),
    onBeforeProviderRequest: vi.fn(),
    onAfterProviderResponse: vi.fn(),
    onToolCall: vi.fn(),
    onToolResult: vi.fn(),
    onMessageEnd: vi.fn(),
    onTurnEnd: vi.fn(),
    onSessionShutdown: vi.fn(),
    registerCommand: (pi: any) => pi.registerCommand('traces', { handler: vi.fn() }),
  })),
}));

vi.mock('../../src/adapters/loader', () => ({
  loadAdapter: vi.fn(async () => ({
    configureFromEnv: (_env: any) => undefined,
  })),
}));

import indexDefault from '../../src/index';
import * as otelModule from '../../src/otel';

describe('index fallback config', () => {
  it('uses buildConfigFromEnv when adapter.configureFromEnv returns undefined', async () => {
    // ensure env vars are not set so defaults apply
    delete process.env.MLFLOW_TRACKING_URI;
    delete process.env.MLFLOW_EXPERIMENT_ID;
    delete process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
    delete process.env.OTEL_EXPORTER_OTLP_TRACES_HEADERS;

    const events: Record<string, any[]> = {};
    const pi: any = {
      on: (event: string, handler: any) => { events[event] = events[event] || []; events[event].push(handler); },
      registerCommand: (name: string, opts: any) => { pi.lastCommand = { name, opts }; },
      logger: { info: vi.fn(), error: vi.fn() },
    };

    await indexDefault(pi);

    expect((otelModule.createSdk as any)).toHaveBeenCalled();
    // check createSdk called with default otlpEndpoint derived from default tracking uri
    const calledArg = (otelModule.createSdk as any).mock.calls[0][0];
    expect(calledArg).toBeDefined();
    expect(calledArg.otlpEndpoint).toContain('http://localhost:5000');
  });
});
