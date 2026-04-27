import { configureFromEnv as configFromEnv } from './config';

const mlflowAdapter = {
  id: 'mlflow',
  configureFromEnv: (env: any) => configFromEnv(env),
  createTraceCommandHandlers: (config: any) => ({
    listTraces: async (ctx: any) => {
      ctx.ui?.notify?.('mlflow adapter: listTraces not implemented', 'info');
    },
    showTrace: async (id: string, ctx: any) => {
      ctx.ui?.notify?.('mlflow adapter: showTrace not implemented', 'info');
    },
  }),
  createExporter: (config: any) => ({ headers: config.otlpHeaders ?? {}, endpoint: config.otlpEndpoint }),
};

export default mlflowAdapter;
