import type { Span, SpanOptions } from '@opentelemetry/api';

export interface ExtensionConfig {
  mlflowTrackingUri: string;
  mlflowExperimentId?: string | number;
  otlpEndpoint: string;
  otlpHeaders?: Record<string, string> | undefined;
}

export interface SessionManager {
  getSessionFile?: () => string;
}

export interface UI {
  setStatus?: (key: string, value?: string) => void;
  setWidget?: (id: string, lines: string[]) => void;
  notify?: (msg: string, level?: string) => void;
  custom?: (fn: any) => void;
}

export interface ExtensionContext {
  sessionManager?: SessionManager;
  ui?: UI;
  cwd?: string;
}

export type Handler = (event: any, ctx?: ExtensionContext) => Promise<void> | void;

export interface Handlers {
  onTurnStart: Handler;
  onBeforeProviderRequest: Handler;
  onAfterProviderResponse: Handler;
  onToolCall: Handler;
  onToolResult: Handler;
  onMessageEnd: Handler;
  onTurnEnd: Handler;
  onSessionShutdown: Handler;
  registerCommand?: (pi: any) => void;
}

// Minimal SpanLike interface used by the extension to ease testing
export interface SpanLike {
  setAttribute(key: string, value: any): void;
  setAttributes?(attrs: Record<string, any>): void;
  setStatus?(status: { code: number | string; message?: string }): void;
  addEvent?(name: string, attributes?: Record<string, any>): void;
  end(endTime?: number): void;
  spanContext?: () => { traceId?: string };
}

export type TracerLike = {
  startSpan(name: string, options?: any, ctx?: any): SpanLike;
};
