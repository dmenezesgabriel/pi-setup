import { describe, it, expect, vi } from 'vitest';

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

describe('index headers', () => {
  it('includes x-mlflow-experiment-id header when MLFLOW_EXPERIMENT_ID set', async () => {
    const prev = process.env.MLFLOW_EXPERIMENT_ID;
    process.env.MLFLOW_EXPERIMENT_ID = '99';
    const events: Record<string, any[]> = {};
    const pi: any = {
      on: (event: string, handler: any) => { events[event] = events[event] || []; events[event].push(handler); },
      registerCommand: (name: string, opts: any) => { pi.lastCommand = { name, opts }; },
      logger: { info: vi.fn(), error: vi.fn() },
    };

    await indexDefault(pi);

    const calledArg = (otelModule.createSdk as any).mock.calls[0][0];
    expect(calledArg.otlpHeaders).toBeDefined();
    expect(calledArg.otlpHeaders['x-mlflow-experiment-id']).toBe('99');

    if (prev === undefined) delete process.env.MLFLOW_EXPERIMENT_ID; else process.env.MLFLOW_EXPERIMENT_ID = prev;
  });
});
