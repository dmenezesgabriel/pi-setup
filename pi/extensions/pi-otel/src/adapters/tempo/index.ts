const tempoAdapter = {
  id: 'tempo',
  configureFromEnv: (env: any) => ({
    otlpEndpoint: env.TEMPO_ENDPOINT || 'http://localhost:9411',
    otlpHeaders: {},
  }),
  createTraceCommandHandlers: (_config: any) => ({
    listTraces: async (ctx: any) => {
      ctx.ui?.notify?.('tempo adapter: listTraces not implemented', 'info');
    },
    showTrace: async (id: string, ctx: any) => {
      ctx.ui?.notify?.('tempo adapter: showTrace not implemented', 'info');
    },
  }),
  createExporter: (_config: any) => ({ headers: {}, endpoint: undefined }),
};

export default tempoAdapter;
