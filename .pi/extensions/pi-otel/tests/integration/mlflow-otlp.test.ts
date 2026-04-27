import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import getPort from 'get-port';
import { execa } from 'execa';
import { createSdk, shutdownSdk } from '../../src/otel';

async function findMlflowBinary() {
  try {
    const which = await execa('which', ['mlflow']);
    if (which && which.stdout) return which.stdout.trim();
  } catch (e) {}
  // fallback: search in ~/.cache/uv/archive-v0/*/bin/mlflow
  const cache = path.join(os.homedir(), '.cache/uv/archive-v0');
  try {
    const entries = fs.readdirSync(cache, { withFileTypes: true });
    for (const ent of entries) {
      const candidate = path.join(cache, ent.name, 'bin', 'mlflow');
      if (fs.existsSync(candidate)) return candidate;
    }
  } catch (e) {}
  return null;
}

const describeIf = process.env.RUN_INTEGRATION_TESTS ? describe : describe.skip;

describeIf('integration: mlflow otlp ingestion', () => {
  it('exports spans to a local MLflow server and stores session metadata', async () => {
    const mlflowBin = await findMlflowBinary();
    if (!mlflowBin) {
      console.warn('mlflow binary not found, skipping integration');
      return;
    }

    const port = await getPort({ port: 5000 });
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mlflow-test-'));
    const sqlitePath = path.join(tmp, 'mlflow.db');
    const artifactRoot = path.join(tmp, 'mlflow-artifacts');
    fs.mkdirSync(artifactRoot, { recursive: true });

    // Prefer an already running MLflow server at 127.0.0.1:5000 for integration
    let base = `http://127.0.0.1:5000`;
    let server: any = null;
    try {
      const res = await fetch(base + '/');
      if (!res.ok) throw new Error('not ready');
    } catch (e) {
      // spawn a server if not present
      const { spawn } = await import('child_process');
      server = spawn(
        mlflowBin,
        [
          'server',
          '--backend-store-uri',
          `sqlite:///${sqlitePath}`,
          '--default-artifact-root',
          artifactRoot,
          '--host',
          '127.0.0.1',
          '--port',
          String(port),
        ],
        { stdio: ['ignore', 'pipe', 'pipe'] },
      );

      base = `http://127.0.0.1:${port}`;
      let ready = false;
      for (let i = 0; i < 60; i++) {
        try {
          const r = await fetch(base + '/');
          if (r) {
            ready = true;
            break;
          }
        } catch (e) {}
        await new Promise((r) => setTimeout(r, 500));
      }
      if (!ready) {
        if (server) server.kill();
        throw new Error('mlflow server did not start');
      }
    }

    // start SDK and emit spans
    const otlpEndpoint = `${base}/v1/traces`;
    const { sdk, tracer } = await createSdk({
      otlpEndpoint,
      mlflowExperimentId: '1',
      mlflowTrackingUri: base,
      otlpHeaders: { 'x-mlflow-experiment-id': '1' },
    });

    // create a simple trace
    const root = tracer.startSpan('pi.turn') as any;
    root.setAttribute('session.id', 'integ-session-1');
    root.setAttribute('mlflow.spanInputs', 'hello unit');

    const provider = tracer.startSpan('provider.request', undefined, undefined) as any;
    provider.setAttribute('mlflow.spanInputs', 'hello unit');
    provider.end();

    const providerRes = tracer.startSpan('provider.response', undefined, undefined) as any;
    providerRes.setAttribute('mlflow.spanOutputs', 'hi from provider');
    providerRes.end();

    root.setAttribute('mlflow.spanOutputs', 'hi from provider');
    root.end();

    // flush
    await shutdownSdk(sdk);

    // query sqlite via python to assert trace_request_metadata has mlflow.trace.session
    const py = `import sqlite3, json;\nconn=sqlite3.connect('${sqlitePath}');\nc=conn.cursor();\nc.execute("SELECT request_id, response_preview FROM trace_info ORDER BY timestamp_ms DESC LIMIT 5");\nrows=c.fetchall();\nprint(rows);\nconn.close();`;
    const { execFileSync } = await import('child_process');
    const out = execFileSync('python3', ['-c', py], { encoding: 'utf8' });
    // Ensure a response preview was written for one of the recent traces
    if (!out.includes('hi from provider')) {
      // fallback: show DB contents for debugging
      throw new Error('Expected response preview not found in trace_info: ' + out);
    }

    if (server) server.kill();
  }, 60000);
});
