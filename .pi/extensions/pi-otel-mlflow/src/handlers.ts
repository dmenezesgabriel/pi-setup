import type { TracerLike, Handlers, SpanLike } from './types';
import {
  generateId,
  truncateText,
  getPromptFromEvent,
  getMessageContent,
  getOutputFromEvent,
  normalizeSessionId,
  setSpanAttribute,
} from './utils';
import type { ExtensionConfig } from './types';
import { SpanStatusCode } from '@opentelemetry/api';

// Module-level helpers for trace formatting & HTTP fetch so handlers stay small
async function fetchJson(url: string, body: any) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function getTraceInfo(t: any) {
  return t.trace_info ?? t.traceInfo ?? t;
}

function getTraceId(t: any) {
  const info = getTraceInfo(t);
  return info?.trace_id ?? info?.request_id ?? t.trace_id ?? '(no-id)';
}

function getTraceTimestamp(t: any) {
  const info = getTraceInfo(t);
  return info?.timestamp_ms ? new Date(Number(info.timestamp_ms)).toISOString() : '';
}

function getTraceDuration(t: any) {
  const info = getTraceInfo(t);
  return info?.execution_time_ms ? `${info.execution_time_ms}ms` : '';
}

function getRequestPreview(t: any) {
  const info = getTraceInfo(t);
  return (info?.request_preview || info?.request || t.request || '').toString();
}

function formatTraceLine(t: any): string {
  const tid = getTraceId(t);
  const ts = getTraceTimestamp(t);
  const dur = getTraceDuration(t);
  const requestPreview = getRequestPreview(t);
  return `${tid} | ${ts} | ${dur} | ${requestPreview.slice(0, 160).replace(/\n/g, ' ')}`;
}

function getSpanName(s: any): string {
  return s?.name ?? s?.spanName ?? 'span';
}

function getSpanTimes(s: any): { start: string; end: string } {
  const start = s?.startTimeUnixNano
    ? new Date(Number(s.startTimeUnixNano) / 1e6).toISOString()
    : '';
  const end = s?.endTimeUnixNano ? new Date(Number(s.endTimeUnixNano) / 1e6).toISOString() : '';
  return { start, end };
}

function getSpanDuration(s: any): string {
  return s?.endTimeUnixNano && s?.startTimeUnixNano
    ? `${(Number(s.endTimeUnixNano) - Number(s.startTimeUnixNano)) / 1e6}ms`
    : '';
}

function formatSpanEntry(s: any): string {
  const name = getSpanName(s);
  const { start, end } = getSpanTimes(s);
  const dur = getSpanDuration(s);
  const line = `${name} | ${start} → ${end} | ${dur}`;
  if (s?.attributes) return `${line}\n  attrs: ${JSON.stringify(s.attributes).slice(0, 400)}`;
  return line;
}

async function fetchTracesForExperiment(trackingUri: string, experimentId: string) {
  const url = `${trackingUri.replace(/\/$/, '')}/api/2.0/mlflow/traces/search`;
  const json = await fetchJson(url, { experiment_ids: [String(experimentId)], max_results: 20 });
  return json?.traces ?? json?.results ?? [];
}

async function fetchTraceById(trackingUri: string, id: string) {
  const url = `${trackingUri.replace(/\/$/, '')}/api/2.0/mlflow/traces/batchGet`;
  const json = await fetchJson(url, { trace_ids: [id] });
  return json?.traces ?? json?.results ?? [];
}

function routeMessageEvent(
  msg: any,
  id: string | undefined,
  event: any,
  ctx: any,
  userHandler: Function,
  assistantHandler: Function,
) {
  if (!msg || !id) return;
  const role = msg?.role;
  if (role === 'user') return userHandler(msg, id, event, ctx);
  if (role === 'assistant') return assistantHandler(msg, event, ctx);
}

function applyAssistantOutputsToRoot(root: SpanLike, assistantMsg: any) {
  const out = getOutputFromEvent(assistantMsg) ?? getMessageContent(assistantMsg);
  if (!out) return;
  setSpanAttribute(root, 'mlflow.spanOutputs', truncateText(out, 2000));
}

function applyParentInputsToRoot(
  root: SpanLike,
  parentId: string | undefined,
  messageIdToUserText: Map<string, string>,
) {
  if (!parentId) return;
  const userText = messageIdToUserText.get(String(parentId));
  if (!userText) return;
  setSpanAttribute(root, 'mlflow.spanInputs', truncateText(userText, 2000));
}

function renderTracesList(ctx: any, traces: any[]) {
  if (!Array.isArray(traces) || traces.length === 0) {
    ctx.ui?.notify?.('No traces returned', 'info');
    return;
  }
  const lines = traces.map(formatTraceLine);
  ctx.ui?.setWidget?.('mlflow-traces', lines);
}

function renderTraceDetail(ctx: any, trace: any) {
  const spans = trace?.spans ?? trace?.Spans ?? [];
  const out: string[] = [];
  out.push(`Trace ${getTraceId(trace)}`);
  out.push('---');
  for (const s of spans) {
    out.push(formatSpanEntry(s));
  }
  ctx.ui?.custom?.((tui: any) => new (require('@mariozechner/pi-tui').Text)(out.join('\n'), 0, 0));
}

export function createTracingHandlers(tracer: TracerLike, config: ExtensionConfig): Handlers {
  const sessionFileToTurnId = new Map<string, string>();
  const turnIdToRootSpan = new Map<string, SpanLike>();
  const providerEventIdToSpan = new Map<string, SpanLike>();
  const toolCallIdToSpan = new Map<string, SpanLike>();
  const messageIdToUserText = new Map<string, string>();

  function getSessionFileFromContext(ctx: any): string {
    return ctx?.sessionManager?.getSessionFile?.() ?? 'ephemeral';
  }

  function sessionKeyFromFile(rawSessionFile: string): string {
    return String(rawSessionFile);
  }

  function getFallbackEventId(event: any): string | undefined {
    return event?.requestId ?? event?.responseId ?? event?.id ?? undefined;
  }

  function resolveTurnIdForEvent(event: any, ctx: any): string | undefined {
    const rawSessionFile = getSessionFileFromContext(ctx) || event?.session || event?.sessionFile;
    const key = sessionKeyFromFile(rawSessionFile);
    const mapped = sessionFileToTurnId.get(key);
    if (mapped) return mapped;
    return getFallbackEventId(event);
  }

  function setTurnForSession(rawSessionFile: string, turnId: string) {
    sessionFileToTurnId.set(sessionKeyFromFile(rawSessionFile), turnId);
  }

  function onTurnStart(event: any, ctx: any) {
    const rawSessionFile = getSessionFileFromContext(ctx);
    const sanitizedSessionId = normalizeSessionId(rawSessionFile);
    const turnId = generateId();

    const span = tracer.startSpan('pi.turn', undefined, undefined) as SpanLike;
    setSpanAttribute(span, 'pi.session', rawSessionFile);
    setSpanAttribute(span, 'mlflow.trace.session', sanitizedSessionId);
    setSpanAttribute(span, 'session.id', sanitizedSessionId);
    setSpanAttribute(span, 'mlflow.trace.session_path', rawSessionFile);
    setSpanAttribute(span, 'pi.cwd', ctx?.cwd ?? process.cwd());

    setTurnForSession(rawSessionFile, turnId);
    turnIdToRootSpan.set(turnId, span);

    try {
      ctx?.ui?.setStatus?.('telemetry', `trace ${turnId}`);
    } catch (err) {
      // ignore UI errors
    }
  }

  function propagatePromptToRoot(root: SpanLike, event: any, span?: SpanLike) {
    const prompt = getPromptFromEvent(event);
    if (!prompt) return;
    const preview = truncateText(prompt, 2000);
    if (span) setSpanAttribute(span, 'mlflow.spanInputs', preview);
    try {
      setSpanAttribute(root, 'mlflow.spanInputs', preview);
    } catch (e) {
      // ignore
    }
  }

  function createProviderRequestSpan(root: SpanLike, event: any): SpanLike {
    const span = tracer.startSpan('provider.request', undefined, undefined) as SpanLike;
    const modelId = event?.payload?.model ?? event?.model ?? event?.provider?.model;
    if (modelId) setSpanAttribute(span, 'mlflow.model_id', modelId);
    if (event?.provider) setSpanAttribute(span, 'provider', event.provider);
    propagatePromptToRoot(root, event, span);
    return span;
  }

  function onBeforeProviderRequest(event: any, ctx: any) {
    const turnId = resolveTurnIdForEvent(event, ctx);
    if (!turnId) return;
    const root = turnIdToRootSpan.get(turnId);
    if (!root) return;

    const span = createProviderRequestSpan(root, event);

    const providerEventId = event?.requestId ?? event?.id ?? generateId();
    providerEventIdToSpan.set(String(providerEventId), span);
    try {
      event._providerId = providerEventId;
    } catch (e) {
      // ignore
    }
  }

  function applyTokenUsage(span: SpanLike, event: any) {
    const tokenUsage = event?.details?.tokenUsage ?? event?.tokenUsage;
    if (tokenUsage) setSpanAttribute(span, 'mlflow.trace.tokenUsage', JSON.stringify(tokenUsage));
  }

  function applyStopReason(span: SpanLike, event: any) {
    const stopReason = event?.stopReason ?? event?.details?.stop_reason;
    if (stopReason) setSpanAttribute(span, 'stop_reason', stopReason);
  }

  function applyOutputPreview(span: SpanLike, event: any, ctx: any) {
    const output = getOutputFromEvent(event);
    if (!output) return;
    const preview = truncateText(output, 2000);
    setSpanAttribute(span, 'mlflow.spanOutputs', preview);
    const turnId = resolveTurnIdForEvent(event, ctx);
    if (turnId) {
      const root = turnIdToRootSpan.get(turnId);
      if (root) setSpanAttribute(root, 'mlflow.spanOutputs', preview);
    }
  }

  function applyErrorStatus(span: SpanLike, event: any) {
    if (event?.status === 'error' || event?.stopReason === 'error') {
      try {
        span.setStatus?.({
          code: SpanStatusCode.ERROR,
          message: String(event?.errorMessage ?? 'error'),
        });
      } catch (e) {
        // ignore
      }
    }
  }

  function endSpanSafely(span: SpanLike) {
    try {
      span.end();
    } catch (e) {
      // ignore
    }
  }

  function onAfterProviderResponse(event: any, ctx: any) {
    const providerEventId = event?.requestId ?? event?.id ?? event?._providerId;
    if (!providerEventId) return;
    const span = providerEventIdToSpan.get(String(providerEventId));
    if (!span) return;

    applyTokenUsage(span, event);
    applyStopReason(span, event);
    applyOutputPreview(span, event, ctx);
    applyErrorStatus(span, event);
    endSpanSafely(span);

    providerEventIdToSpan.delete(String(providerEventId));
  }

  function onToolCall(event: any, ctx: any) {
    const turnId = resolveTurnIdForEvent(event, ctx);
    if (!turnId) return;
    const root = turnIdToRootSpan.get(turnId);
    if (!root) return;

    const callId = event.toolCallId ?? `${event.toolName}-${Date.now()}`;
    const span = tracer.startSpan(`tool.${event.toolName}`, undefined, undefined) as SpanLike;
    setSpanAttribute(span, 'tool.name', event.toolName);
    try {
      setSpanAttribute(span, 'tool.args', JSON.stringify(event.input ?? event.args ?? {}));
    } catch (e) {
      // ignore
    }

    if (event.toolCallId) toolCallIdToSpan.set(event.toolCallId, span);
  }

  function finalizeToolSpan(span: SpanLike, event: any) {
    if (event.isError) {
      try {
        span.setStatus?.({
          code: SpanStatusCode.ERROR,
          message: String(event?.details?.error ?? 'tool error'),
        });
      } catch (e) {
        // ignore
      }
    }
    try {
      if (event.details) setSpanAttribute(span, 'tool.details', JSON.stringify(event.details));
    } catch (e) {
      // ignore
    }
    endSpanSafely(span);
  }

  function onToolResult(event: any, ctx: any) {
    const span = event.toolCallId ? toolCallIdToSpan.get(event.toolCallId) : undefined;
    if (!span) return;
    finalizeToolSpan(span, event);
    if (event.toolCallId) toolCallIdToSpan.delete(event.toolCallId);
  }

  function handleUserMessage(msg: any, id: string, event: any, ctx: any) {
    const prompt = getPromptFromEvent(msg) || getPromptFromEvent({ payload: msg });
    if (!prompt) return;
    const preview = truncateText(prompt, 2000);
    messageIdToUserText.set(String(id), preview);
    const turnId = resolveTurnIdForEvent(event, ctx);
    if (!turnId) return;
    const root = turnIdToRootSpan.get(turnId);
    if (!root) return;
    setSpanAttribute(root, 'mlflow.spanInputs', preview);
  }

  function getModelIdFromEvent(event: any): string | undefined {
    return event?.payload?.model ?? event?.model ?? event?.provider?.model;
  }

  function getProviderFromEvent(event: any): any {
    return event?.api ?? event?.provider ?? undefined;
  }

  function createAssistantSpan(event: any): SpanLike {
    const span = tracer.startSpan('provider.response', undefined, undefined) as SpanLike;
    const modelId = getModelIdFromEvent(event);
    if (modelId) setSpanAttribute(span, 'mlflow.model_id', modelId);
    const provider = getProviderFromEvent(event);
    if (provider) setSpanAttribute(span, 'provider', provider);
    return span;
  }

  function applyAssistantOutputs(span: SpanLike, msg: any, root: SpanLike) {
    const outputText = getMessageContent(msg) ?? getOutputFromEvent(msg);
    if (!outputText) return;
    setSpanAttribute(span, 'mlflow.spanOutputs', truncateText(outputText, 2000));
    try {
      setSpanAttribute(root, 'mlflow.spanOutputs', truncateText(outputText, 2000));
    } catch (e) {
      // ignore
    }
  }

  function applyParentInputsToSpan(span: SpanLike, root: SpanLike, event: any) {
    const parentMessageId = event?.parentId ?? event?.message?.parentId ?? undefined;
    if (!parentMessageId) return;
    const userText = messageIdToUserText.get(String(parentMessageId));
    if (!userText) return;
    setSpanAttribute(span, 'mlflow.spanInputs', truncateText(userText, 2000));
    try {
      setSpanAttribute(root, 'mlflow.spanInputs', truncateText(userText, 2000));
    } catch (e) {
      // ignore
    }
  }

  function handleAssistantMessage(msg: any, event: any, ctx: any) {
    const turnId = resolveTurnIdForEvent(event, ctx);
    if (!turnId) return;
    const root = turnIdToRootSpan.get(turnId);
    if (!root) return;

    const span = createAssistantSpan(event);
    applyAssistantOutputs(span, msg, root);
    applyParentInputsToSpan(span, root, event);
    endSpanSafely(span);
  }

  function onMessageEnd(event: any, ctx: any) {
    const msg = event?.message ?? event?.payload ?? undefined;
    const id = event?.id ?? event?.message?.id ?? event?.payload?.id ?? undefined;
    if (!msg || !id) return;

    if (msg.role === 'user') return handleUserMessage(msg, String(id), event, ctx);
    if (msg.role === 'assistant') return handleAssistantMessage(msg, event, ctx);
  }

  function finalizeTurn(root: SpanLike, event: any, ctx: any) {
    const assistantMsg = event?.message ?? event?.assistantMessage;
    if (assistantMsg) {
      const out = getOutputFromEvent(assistantMsg) ?? getMessageContent(assistantMsg);
      if (out) setSpanAttribute(root, 'mlflow.spanOutputs', truncateText(out, 2000));
    }

    const parentId = event?.message?.parentId ?? event?.parentId;
    if (parentId) {
      const userText = messageIdToUserText.get(String(parentId));
      if (userText) setSpanAttribute(root, 'mlflow.spanInputs', truncateText(userText, 2000));
    }
  }

  function onTurnEnd(event: any, ctx: any) {
    const rawSessionFile = getSessionFileFromContext(ctx);
    const key = sessionKeyFromFile(rawSessionFile);
    const turnId = sessionFileToTurnId.get(key);
    if (!turnId) return;

    const root = turnIdToRootSpan.get(turnId);
    if (!root) return;

    finalizeTurn(root, event, ctx);

    try {
      root.end();
    } catch (e) {
      // ignore
    }
    turnIdToRootSpan.delete(turnId);
    sessionFileToTurnId.delete(key);
    if (ctx?.ui)
      try {
        ctx.ui.setStatus?.('telemetry', undefined);
      } catch (e) {
        // ignore
      }
  }

  function onSessionShutdown() {
    // nothing special here for now
  }

  async function listTraces(ctx: any) {
    try {
      const tracesModule = await import('./traces');
      await tracesModule.listTraces(config, ctx);
    } catch (err: any) {
      ctx.ui?.notify?.(`MLflow search error: ${err?.message ?? String(err)}`, 'error');
    }
  }

  async function showTrace(id: string, ctx: any) {
    try {
      const tracesModule = await import('./traces');
      await tracesModule.showTrace(config, id, ctx);
    } catch (err: any) {
      ctx.ui?.notify?.(`MLflow fetch error: ${err?.message ?? String(err)}`, 'error');
    }
  }

  async function handleTracesCommand(args: string | undefined, ctx: any) {
    try {
      const tracesModule = await import('./traces');
      const handler = tracesModule.createTracesHandler(config);
      await handler(args, ctx);
    } catch (err: any) {
      ctx.ui?.notify?.(`MLflow fetch error: ${err?.message ?? String(err)}`, 'error');
    }
  }

  function registerCommand(pi: any) {
    pi.registerCommand('traces', {
      description: 'List traces from MLflow (usage: /traces [list|show <traceId>])',
      handler: handleTracesCommand,
    });
  }

  return {
    onTurnStart,
    onBeforeProviderRequest,
    onAfterProviderResponse,
    onToolCall,
    onToolResult,
    onMessageEnd,
    onTurnEnd,
    onSessionShutdown,
    registerCommand,
  };
}
