import { describe, it, expect, vi } from 'vitest';
import { createTracesHandler } from '../../src/adapters/mlflow/traces';

describe('traces handler usage', () => {
  it('shows usage when unknown args provided', async () => {
    const cfg: any = { mlflowTrackingUri: 'http://localhost:5000', mlflowExperimentId: '1' };
    const handler = createTracesHandler(cfg, async () => ({ traces: [] } as any));
    const ui = { notify: vi.fn(), setWidget: vi.fn(), custom: vi.fn() };
    const ctx = { ui } as any;
    await handler('unknownsub', ctx);
    expect(ui.notify).toHaveBeenCalledWith('Usage: /traces [list|show <traceId>]', 'info');
  });
});
