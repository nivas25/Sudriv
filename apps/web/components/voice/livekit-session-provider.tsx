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
 * LiveKit room wrapper.
 * audio={false}: push-to-talk only — mic stays off until user holds PTT.
 * RoomAudioRenderer volume reduced so agent TTS is less harsh.
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
        console.info("[LiveKit] token ok room=", data.roomName);
      } catch (e) {
        console.error("[LiveKit] token fetch failed", e);
        if (!cancelled) {
          setError("Failed to connect to voice service");
        }
      }
    };

    void fetchToken();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 p-6">
        <p className="text-red-500 text-sm font-medium">Voice Error: {error}</p>
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
      // Critical: do NOT auto-publish mic (push-to-talk)
      audio={false}
      video={false}
      connectOptions={{
        autoSubscribe: true,
      }}
      onDisconnected={(reason) => {
        console.info("[LiveKit] disconnected", reason);
      }}
      onConnected={() => {
        console.info("[LiveKit] connected", roomName);
      }}
      onError={(e) => {
        console.error("[LiveKit] room error", e);
      }}
      className="h-full"
    >
      <LiveKitReadyContext.Provider value={true}>
        {/* Slightly quieter agent playback */}
        <RoomAudioRenderer volume={0.65} />
        <MicController />
        {children}
      </LiveKitReadyContext.Provider>
    </LiveKitRoom>
  );
}
