"use client";

import { useEffect, useState } from "react";
import { fetchLiveKitToken, type LiveKitTokenResponse } from "@/lib/livekit/token";

/**
 * Hook: useLiveKitToken
 *
 * Fetches a LiveKit access token for the given session.
 * Used by the VoicePanel to connect to the LiveKit room.
 *
 * See: knowledge-base/07-frontend-architecture.md (LiveKit Integration)
 */
export function useLiveKitToken(sessionId: string) {
  const [tokenData, setTokenData] = useState<LiveKitTokenResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function getToken() {
      try {
        const data = await fetchLiveKitToken(sessionId);
        if (!cancelled) {
          setTokenData(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to get token");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    getToken();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return { tokenData, error, isLoading };
}
