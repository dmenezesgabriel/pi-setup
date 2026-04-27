export async function loadAdapter(name?: string): Promise<any> {
  const adapterName = name || process.env.OTEL_ADAPTER || 'mlflow';
  try {
    // dynamic import relative to src/adapters
    const mod = await import(`./${adapterName}`);
    // adapter can be default export or named exports
    return mod?.default ?? mod;
  } catch (err) {
    throw new Error(`Adapter not found: ${adapterName}`);
  }
}
