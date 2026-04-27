import { describe, it, expect } from 'vitest';
import indexDefault from '../../src/index';

describe('index no logger', () => {
  it('does not throw when pi has no logger', async () => {
    const pi: any = {
      on: (event: string, handler: any) => { pi._events = pi._events || {}; pi._events[event] = pi._events[event] || []; pi._events[event].push(handler); },
      registerCommand: (name: string, opts: any) => { pi.lastCommand = { name, opts }; },
    };
    await expect(indexDefault(pi)).resolves.not.toThrow();
  });
});
