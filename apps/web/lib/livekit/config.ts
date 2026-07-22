/**
 * Shared LiveKit agent identity for Sudriv.
 * Worker (Python) and token/dispatch APIs must use the same name.
 */
export const SUDRIV_AGENT_NAME = "sudriv";

export function livekitHttpHost(wsUrl: string): string {
  return wsUrl.replace("wss://", "https://").replace("ws://", "http://");
}

export function roomNameForSession(sessionId: string): string {
  return `sudriv-${sessionId}`;
}
