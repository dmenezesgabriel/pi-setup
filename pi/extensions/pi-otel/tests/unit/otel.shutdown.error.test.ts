import { describe, it, expect } from 'vitest';
import { shutdownSdk } from '../../src/core/otel';

class BadSDK {
  async shutdown() {
    throw new Error('shutdown failed');
  }
}

describe('otel shutdown error handling', () => {
  it('does not throw when sdk.shutdown throws', async () => {
    const s = new BadSDK() as any;
    await expect(shutdownSdk(s)).resolves.toBeUndefined();
  });
});
