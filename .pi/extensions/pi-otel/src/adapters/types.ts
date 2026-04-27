export interface AdapterConfig {
  // Adapter-specific configuration payload
  [key: string]: any;
}

export interface TraceCommandHandlers {
  listTraces?: (ctx: any) => Promise<void> | void;
  showTrace?: (id: string, ctx: any) => Promise<void> | void;
  tracesCommandHandler?: (args: string | undefined, ctx: any) => Promise<void> | void;
}

export interface Adapter {
  id: string;
  configureFromEnv(env: Record<string, any>): AdapterConfig;
  createTraceCommandHandlers(config: AdapterConfig): TraceCommandHandlers;
  createExporter?(config: AdapterConfig): any;
}
