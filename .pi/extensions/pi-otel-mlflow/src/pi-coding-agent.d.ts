declare module '@mariozechner/pi-coding-agent' {
  export interface ExtensionAPI {
    on(event: string, handler: (...args: any[]) => void): void;
    registerCommand(name: string, opts: any): void;
    logger?: { info?: (...args: any[]) => void; error?: (...args: any[]) => void };
    ui?: any;
    sessionManager?: any;
  }
  export type ExtensionAPI = ExtensionAPI;
}
