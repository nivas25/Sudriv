/**
 * LiveKit Token Utility
 *
 * Client-side helper to fetch a LiveKit access token from the API.
 * Used by the VoicePanel component to connect to a LiveKit room.
 *
 * See: knowledge-base/07-frontend-architecture.md (LiveKit Integration)
 */

export interface LiveKitTokenResponse {
  token: string;
  roomName: string;
  url: string;
}

export async function fetchLiveKitToken(
  sessionId: string
): Promise<LiveKitTokenResponse> {
  const response = await fetch("/api/livekit/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch LiveKit token: ${response.statusText}`);
  }

  return response.json();
}
