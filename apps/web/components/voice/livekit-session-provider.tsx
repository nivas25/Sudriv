"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
} from "@livekit/components-react";
import { MicController } from "@/components/voice/mic-controller";

/** True only when children are mounted under a live LiveKitRoom. */
const LiveKitReadyContext = createContext(false);

export function useLiveKitReady() {
  return useContext(LiveKitReadyContext);
}

/**
 * LiveKitSessionProvider — Wraps the session page in a LiveKit room connection.
 *
 * 1. Fetches a token from /api/livekit/token
 * 2. Connects to the LiveKit room
 * 3. Forces microphone publish so the agent can hear the producer
 * 4. Renders agent audio via RoomAudioRenderer
 */
export function LiveKitSessionProvider({
  sessionId,
  children,
}: {
  sessionId: string;
  children: ReactNode;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchToken = async () => {
      try {
        const res = await fetch("/api/livekit/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (!cancelled) {
            setError(
              (data as { error?: string }).error || "Failed to get LiveKit token",
            );
          }
          return;
        }

        const data = await res.json();
        if (cancelled) return;

        setToken(data.token);
        setUrl(data.url);
        setRoomName(data.roomName ?? null);
        console.log("[LiveKit] Token received for room:", data.roomName);
      } catch (e) {
        console.error("[LiveKit] Token fetch failed:", e);
        if (!cancelled) {
          setError("Failed to connect to voice service");
        }
      }
    };

    fetchToken();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 p-6">
        <p className="text-red-500 text-sm font-medium">Voice Error: {error}</p>
        <p className="text-xs text-muted-foreground">
          Check LIVEKIT_API_KEY / LIVEKIT_API_SECRET / NEXT_PUBLIC_LIVEKIT_URL
        </p>
      </div>
    );
  }

  if (!token || !url) {
    return (
      <LiveKitReadyContext.Provider value={false}>
        {children}
      </LiveKitReadyContext.Provider>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={url}
      token={token}
      connect={true}
      audio={{
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      }}
      video={false}
      connectOptions={{
        autoSubscribe: true,
      }}
      onDisconnected={(reason) => {
        console.log("[LiveKit] Disconnected from room", reason);
      }}
      onConnected={() => {
        console.log("[LiveKit] Connected to room", roomName);
      }}
      onError={(e) => {
        console.error("[LiveKit] Room error:", e);
      }}
      className="h-full"
    >
      <LiveKitReadyContext.Provider value={true}>
        <RoomAudioRenderer />
        <MicController />
        {children}
      </LiveKitReadyContext.Provider>
    </LiveKitRoom>
  );
}
