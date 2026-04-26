import { describe, it, expect } from 'vitest';
import { getSessionFileFromContext, sessionKeyFromFile, resolveTurnIdForEvent, setTurnForSession, getFallbackEventId } from '../../src/handlers/session';

describe('handlers/session', () => {
  it('getSessionFileFromContext uses sessionManager or ephemeral', () => {
    const ctx1: any = { sessionManager: { getSessionFile: () => '/tmp/s1.jsonl' } };
    expect(getSessionFileFromContext(ctx1)).toBe('/tmp/s1.jsonl');

    const ctx2: any = {};
    expect(getSessionFileFromContext(ctx2)).toBe('ephemeral');
  });

  it('sessionKeyFromFile returns a safe string', () => {
    expect(sessionKeyFromFile('/tmp/s1')).toBe('/tmp/s1');
    expect(sessionKeyFromFile(null as any)).toBe('null');
  });

  it('setTurnForSession stores mapping and resolveTurnIdForEvent returns mapped value', () => {
    const map = new Map<string, string>();
    setTurnForSession(map, '/tmp/sessionA.jsonl', 'turn-123');
    const ctx: any = { sessionManager: { getSessionFile: () => '/tmp/sessionA.jsonl' } };
    const turn = resolveTurnIdForEvent({}, ctx, map);
    expect(turn).toBe('turn-123');
  });

  it('resolveTurnIdForEvent falls back to requestId when no mapping', () => {
    const map = new Map<string, string>();
    const ctx: any = { sessionManager: { getSessionFile: () => '/tmp/none.jsonl' } };
    const event = { requestId: 'req-1' };
    expect(resolveTurnIdForEvent(event, ctx, map)).toBe('req-1');
  });

  it('getFallbackEventId returns request/response/id or undefined', () => {
    expect(getFallbackEventId({ requestId: 'r' })).toBe('r');
    expect(getFallbackEventId({ responseId: 'res' })).toBe('res');
    expect(getFallbackEventId({ id: 'i' })).toBe('i');
    expect(getFallbackEventId({})).toBe(undefined);
  });
});
