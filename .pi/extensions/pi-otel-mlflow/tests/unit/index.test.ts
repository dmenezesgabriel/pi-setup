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

import indexDefault from '../../src/index';
import * as otelModule from '../../src/otel';
import * as handlersModule from '../../src/handlers';

describe('index bootstrap', () => {
  it('registers handlers and shuts down SDK on session_shutdown', async () => {
    const events: Record<string, any[]> = {};
    const pi: any = {
      on: (event: string, handler: any) => { events[event] = events[event] || []; events[event].push(handler); },
      registerCommand: (name: string, opts: any) => { pi.lastCommand = { name, opts }; },
      logger: { info: vi.fn(), error: vi.fn() },
    };

    await indexDefault(pi);

    // createSdk should have been called
    expect((otelModule.createSdk as any)).toHaveBeenCalled();
    // createTracingHandlers should have been called
    expect((handlersModule.createTracingHandlers as any)).toHaveBeenCalled();

    // expected events registered
    const expected = ['turn_start','before_provider_request','after_provider_response','tool_call','tool_result','message_end','turn_end','session_shutdown'];
    for (const e of expected) expect(events[e]).toBeDefined();

    // simulate session_shutdown callbacks; the second registered handler is the SDK shutdown wrapper
    const handlersArray = events['session_shutdown'];
    expect(handlersArray.length).toBeGreaterThanOrEqual(1);

    // call the handlers and expect shutdown to be invoked via otel.shutdownSdk
    for (const h of handlersArray) await h();
    expect((otelModule.shutdownSdk as any)).toHaveBeenCalled();
  });
});
