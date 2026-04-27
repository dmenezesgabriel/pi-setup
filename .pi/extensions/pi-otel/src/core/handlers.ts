import type { TracerLike, Handlers, SpanLike, ExtensionConfig } from './types';
import {
  generateId,
  truncateText,
  getPromptFromEvent,
  getMessageContent,
  getOutputFromEvent,
  normalizeSessionId,
  setSpanAttribute,
} from './utils';
import { SpanStatusCode } from '@opentelemetry/api';
import { getSessionFileFromContext, sessionKeyFromFile, getFallbackEventId, resolveTurnIdForEvent, setTurnForSession } from '../handlers/session';

// Module-level helpers

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

export function createTracingHandlers(tracer: TracerLike, config: ExtensionConfig, adapter?: any): Handlers {
  const sessionFileToTurnId = new Map<string, string>();
  const turnIdToRootSpan = new Map<string, SpanLike>();
  const providerEventIdToSpan = new Map<string, SpanLike>();
  const toolCallIdToSpan = new Map<string, SpanLike>();
  const messageIdToUserText = new Map<string, string>();
  // map event objects (by reference) to spans to support adapters/hosts that pass object references
  const eventObjectToSpan = new WeakMap<object, SpanLike>();


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

    setTurnForSession(sessionFileToTurnId, rawSessionFile, turnId);
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

  function setModelAndProviderAttributes(span: SpanLike, event: any) {
    const modelId = getModelIdFromEvent(event);
    if (modelId) setSpanAttribute(span, 'mlflow.model_id', modelId);
    const provider = getProviderFromEvent(event);
    if (provider) setSpanAttribute(span, 'provider', provider);
  }

  function createProviderRequestSpan(root: SpanLike, event: any): SpanLike {
    const span = tracer.startSpan('provider.request', undefined, undefined) as SpanLike;
    setModelAndProviderAttributes(span, event);
    try {
      const payload = event?.payload ?? event;
      const serial = typeof payload === 'string' ? payload : JSON.stringify(payload);
      setSpanAttribute(span, 'mlflow.request', truncateText(serial, 2000));
      try {
        setSpanAttribute(root, 'mlflow.request', truncateText(serial, 2000));
      } catch (e) {
        // ignore
      }
    } catch (e) {
      // ignore serialization errors
    }
    propagatePromptToRoot(root, event, span);
    return span;
  }

  function onBeforeProviderRequest(event: any, ctx: any) {
    const turnId = resolveTurnIdForEvent(event, ctx, sessionFileToTurnId);
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
    try {
      if (event && typeof event === 'object') eventObjectToSpan.set(event, span);
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
    const turnId = resolveTurnIdForEvent(event, ctx, sessionFileToTurnId);
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
    let providerEventId = event?.requestId ?? event?.id ?? event?._providerId;
    let span: SpanLike | undefined;
    if (providerEventId) span = providerEventIdToSpan.get(String(providerEventId));
    if (!span && event && typeof event === 'object') {
      span = eventObjectToSpan.get(event as object);
    }
    if (!span) return;

    applyTokenUsage(span, event);
    applyStopReason(span, event);
    applyOutputPreview(span, event, ctx);
    applyErrorStatus(span, event);
    endSpanSafely(span);

    if (providerEventId) providerEventIdToSpan.delete(String(providerEventId));
    try {
      if (event && typeof event === 'object') eventObjectToSpan.delete(event as object);
    } catch (e) {
      // ignore
    }
  }

  function onToolCall(event: any, ctx: any) {
    const turnId = resolveTurnIdForEvent(event, ctx, sessionFileToTurnId);
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
    if (preview != null) messageIdToUserText.set(String(id), preview);
    const turnId = resolveTurnIdForEvent(event, ctx, sessionFileToTurnId);
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
    const turnId = resolveTurnIdForEvent(event, ctx, sessionFileToTurnId);
    if (!turnId) return;
    const root = turnIdToRootSpan.get(turnId);
    if (!root) return;

    const span = createAssistantSpan(event);
    applyAssistantOutputs(span, msg, root);
    applyParentInputsToSpan(span, root, event);
    endSpanSafely(span);
  }

  function extractMessageFromEvent(event: any): any | undefined {
    if (!event) return undefined;
    if (event.message) return event.message;
    if (event.payload) return event.payload;
    return undefined;
  }

  function extractIdFromEvent(event: any): string | undefined {
    if (!event) return undefined;
    if (event.id) return String(event.id);
    if (event.message && event.message.id) return String(event.message.id);
    if (event.payload && event.payload.id) return String(event.payload.id);
    return undefined;
  }

  function onMessageEnd(event: any, ctx: any) {
    const msg = extractMessageFromEvent(event);
    const id = extractIdFromEvent(event);
    // delegate routing to helper
    return routeMessageEvent(msg, id, event, ctx, handleUserMessage, handleAssistantMessage);
  }

  function finalizeTurn(root: SpanLike, event: any, ctx: any) {
    // apply assistant outputs if present
    const assistantMsg = event?.message ?? event?.assistantMessage;
    if (assistantMsg) applyAssistantOutputsToRoot(root, assistantMsg);

    // apply parent inputs if present
    const parentId = event?.message?.parentId ?? event?.parentId;
    if (parentId) applyParentInputsToRoot(root, parentId, messageIdToUserText);
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
      if (adapter && typeof adapter.createTraceCommandHandlers === 'function') {
        const handlers = adapter.createTraceCommandHandlers(config);
        if (handlers?.listTraces) {
          await handlers.listTraces(ctx);
          return;
        }
      }
      const tracesModule = await import('../traces');
      await tracesModule.listTraces(config, ctx);
    } catch (err: any) {
      ctx.ui?.notify?.(`MLflow search error: ${err?.message ?? String(err)}`, 'error');
    }
  }

  async function showTrace(id: string, ctx: any) {
    try {
      if (adapter && typeof adapter.createTraceCommandHandlers === 'function') {
        const handlers = adapter.createTraceCommandHandlers(config);
        if (handlers?.showTrace) {
          await handlers.showTrace(id, ctx);
          return;
        }
      }
      const tracesModule = await import('../traces');
      await tracesModule.showTrace(config, id, ctx);
    } catch (err: any) {
      ctx.ui?.notify?.(`MLflow fetch error: ${err?.message ?? String(err)}`, 'error');
    }
  }

  async function handleTracesCommand(args: string | undefined, ctx: any) {
    try {
      if (adapter && typeof adapter.createTraceCommandHandlers === 'function') {
        const handlers = adapter.createTraceCommandHandlers(config);
        if (handlers?.tracesCommandHandler) {
          await handlers.tracesCommandHandler(args, ctx);
          return;
        }
      }
      const tracesModule = await import('../traces');
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
