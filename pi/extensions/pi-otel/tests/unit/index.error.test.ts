import { describe, it, expect, vi } from 'vitest';

// prepare mocks before importing the module under test
const fakeSdk: any = { shutdown: vi.fn() };
const fakeTracer: any = { startSpan: vi.fn() };

vi.mock('../../src/otel', () => ({
  createSdk: vi.fn(async (_cfg: any) => ({ sdk: fakeSdk, tracer: fakeTracer })),
  shutdownSdk: vi.fn(async (s: any) => { if (s && s.shutdown) s.shutdownCalled = true; }),
}));

vi.mock('../../src/handlers', () => ({
  createTracingHandlers: vi.fn((_tracer: any, _config: any) => ({
    onTurnStart: () => { throw new Error('boom'); },
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
    configureFromEnv: (_env: any) => ({ otlpEndpoint: 'http://localhost/', otlpHeaders: {} }),
  })),
}));

import indexDefault from '../../src/index';

describe('index error handling', () => {
  it('wraps handlers and logs errors', async () => {
    const events: Record<string, any[]> = {};
    const logger = { info: vi.fn(), error: vi.fn() };
    const pi: any = {
      on: (event: string, handler: any) => { events[event] = events[event] || []; events[event].push(handler); },
      registerCommand: (name: string, opts: any) => { pi.lastCommand = { name, opts }; },
      logger,
    };

    await indexDefault(pi);

    // get the registered turn_start handlers and call them — they wrap the thrown handler
    const handlersArray = events['turn_start'];
    expect(handlersArray.length).toBeGreaterThan(0);

    // calling the wrapper should not throw and should result in logger.error being called
    for (const h of handlersArray) await h();

    expect(logger.error).toHaveBeenCalled();
    // ensure error log contains handler error message
    const calls = (logger.error as any).mock.calls.flat();
    const hasHandlerError = calls.some((c: any) => typeof c === 'string' && c.includes('pi-otel-mlflow handler error')) || calls.some((c: any) => typeof c === 'string' && c.includes('boom'));
    expect(hasHandlerError).toBeTruthy();
  });
});
