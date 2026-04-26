import type { Span, SpanOptions } from '@opentelemetry/api';

export interface ExtensionConfig {
  mlflowTrackingUri: string;
  mlflowExperimentId?: string | number;
  otlpEndpoint: string;
  otlpHeaders?: Record<string, string> | undefined;
}

export type Handler = (event: any, ctx?: any) => Promise<void> | void;

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
