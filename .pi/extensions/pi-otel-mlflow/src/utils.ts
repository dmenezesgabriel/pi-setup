import type { SpanLike } from './types';
import { v4 as uuidv4 } from 'uuid';

export function parseHeaders(headers?: string | null): Record<string, string> | undefined {
  if (!headers) return undefined;
  const result: Record<string, string> = {};
  const parts = headers
    .split(/[,;\n]/)
    .map((p) => p.trim())
    .filter(Boolean);
  for (const part of parts) {
    const match = part.match(/^([^=:\s]+)\s*(?:=|:)\s*(.*)$/);
    if (match) result[match[1]] = match[2];
  }
  return Object.keys(result).length ? result : undefined;
}

export function truncateText(value: string | undefined | null, max = 2000): string | undefined {
  if (value == null) return undefined;
  const s = String(value);
  if (s.length <= max) return s;
  return s.slice(0, max) + `...(${s.length} chars)`;
}

export function normalizeSessionId(raw?: string | null): string {
  const input = raw ? String(raw) : 'ephemeral';
  const base = input.split('/').pop() ?? input;
  return base.replace(/[^A-Za-z0-9_.-]/g, '_');
}

export function setSpanAttribute(span: SpanLike | undefined | null, key: string, value: any): void {
  if (!span) return;
  try {
    span.setAttribute(key, value == null ? String(value) : value);
  } catch (err) {
    // best-effort
  }
}

function extractMessageArray(payload: any): any[] | undefined {
  return (
    payload.messages ?? payload.message ?? payload.payload?.messages ?? payload.payload?.message
  );
}

function getMessageRole(entry: any): string {
  return entry?.role ?? entry?.name ?? entry?.type ?? '';
}

function getMessageContentField(entry: any): string {
  return entry?.content ?? entry?.text ?? entry?.message ?? entry?.body ?? '';
}

function formatMessageEntry(entry: any): string {
  if (typeof entry === 'string') return entry;
  const role = getMessageRole(entry);
  const content = getMessageContentField(entry);
  return (role ? `${role}: ` : '') + String(content);
}

function getDirectPrompt(payload: any): string | undefined {
  if (!payload) return undefined;
  if (payload.prompt)
    return typeof payload.prompt === 'string' ? payload.prompt : JSON.stringify(payload.prompt);
  if (payload.input)
    return typeof payload.input === 'string' ? payload.input : JSON.stringify(payload.input);
  if (payload.request)
    return typeof payload.request === 'string' ? payload.request : JSON.stringify(payload.request);
  return undefined;
}

export function getPromptFromEvent(event: any): string | undefined {
  if (!event) return undefined;
  try {
    const payload = event.payload ?? event;
    if (!payload) return undefined;

    const messages = extractMessageArray(payload);
    if (Array.isArray(messages) && messages.length)
      return messages.map(formatMessageEntry).join('\n');

    const direct = getDirectPrompt(payload);
    if (direct) return direct;

    return JSON.stringify(payload).slice(0, 2000);
  } catch (err) {
    return undefined;
  }
}

function findPrimaryOutput(event: any): any {
  return (
    event.output ??
    event.response ??
    event.result ??
    event.payload?.output ??
    event.payload?.response
  );
}

function findChoicesOutput(event: any): any[] | undefined {
  return event.choices ?? event.outputs ?? event.payload?.choices ?? event.payload?.outputs;
}

export function getOutputFromEvent(event: any): string | undefined {
  if (!event) return undefined;
  try {
    const primary = findPrimaryOutput(event);
    if (primary != null) return typeof primary === 'string' ? primary : JSON.stringify(primary);

    const choices = findChoicesOutput(event);
    if (Array.isArray(choices) && choices.length)
      return choices
        .map((c: any) => (typeof c === 'string' ? c : JSON.stringify(c)))
        .join('\n---\n');

    return undefined;
  } catch (err) {
    return undefined;
  }
}

// Message content extractor used by handlers
function getMessageArrayOrText(msg: any): string | undefined {
  if (!msg) return undefined;
  if (Array.isArray(msg?.content) && msg.content.length)
    return msg.content
      .map((c: any) => (typeof c === 'string' ? c : c.text || c.content || ''))
      .join('\n');
  if (typeof msg?.content === 'string') return msg.content;
  if (msg?.text) return msg.text;
  return undefined;
}

function getMessagePayloadOutput(msg: any): string | undefined {
  if (msg?.payload && (msg.payload.output || msg.payload.response)) {
    const out = msg.payload.output ?? msg.payload.response;
    return typeof out === 'string' ? out : JSON.stringify(out);
  }
  return undefined;
}

export function getMessageContent(msg: any): string | undefined {
  try {
    const first = getMessageArrayOrText(msg);
    if (first) return first;
    return getMessagePayloadOutput(msg);
  } catch (err) {
    return undefined;
  }
}

export function generateId(): string {
  return uuidv4();
}
