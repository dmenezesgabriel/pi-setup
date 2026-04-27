const grafanaAdapter = {
  id: 'grafana',
  configureFromEnv: (env: any) => ({
    otlpEndpoint: env.GRAFANA_ENDPOINT || 'http://localhost:14268',
    otlpHeaders: {},
  }),
  createTraceCommandHandlers: (_config: any) => ({
    listTraces: async (ctx: any) => {
      ctx.ui?.notify?.('grafana adapter: listTraces not implemented', 'info');
    },
    showTrace: async (id: string, ctx: any) => {
      ctx.ui?.notify?.('grafana adapter: showTrace not implemented', 'info');
    },
  }),
  createExporter: (_config: any) => ({ headers: {}, endpoint: undefined }),
};

export default grafanaAdapter;
