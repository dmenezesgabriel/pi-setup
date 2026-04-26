export function getSessionFileFromContext(ctx: any): string {
  return ctx?.sessionManager?.getSessionFile?.() ?? 'ephemeral';
}

export function sessionKeyFromFile(rawSessionFile: string): string {
  return String(rawSessionFile);
}

export function getFallbackEventId(event: any): string | undefined {
  return event?.requestId ?? event?.responseId ?? event?.id ?? undefined;
}

export function resolveTurnIdForEvent(event: any, ctx: any, sessionFileToTurnId: Map<string, string>): string | undefined {
  const rawSessionFile = getSessionFileFromContext(ctx) || event?.session || event?.sessionFile;
  const key = sessionKeyFromFile(rawSessionFile);
  const mapped = sessionFileToTurnId.get(key);
  if (mapped) return mapped;
  return getFallbackEventId(event);
}

export function setTurnForSession(sessionFileToTurnId: Map<string, string>, rawSessionFile: string, turnId: string) {
  sessionFileToTurnId.set(sessionKeyFromFile(rawSessionFile), turnId);
}
