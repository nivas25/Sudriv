"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
} from "@livekit/components-react";
import { DisconnectReason } from "livekit-client";
import { MicController } from "@/components/voice/mic-controller";
import { AgentPresenceGuard } from "@/components/voice/agent-presence-guard";

const LiveKitReadyContext = createContext(false);

export function useLiveKitReady() {
  return useContext(LiveKitReadyContext);
}

type TokenPayload = {
  token: string;
  url: string;
  roomName: string | null;
};

async function requestToken(sessionId: string): Promise<TokenPayload> {
  const res = await fetch("/api/livekit/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
    credentials: "same-origin",
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error || `Token HTTP ${res.status}`,
    );
  }
  if (!data.token || !data.url) {
    throw new Error("Token response missing token or url");
  }

  console.info(
    "[LiveKit] token ok room=",
    data.roomName,
    "url=",
    data.url,
  );

  return {
    token: data.token as string,
    url: data.url as string,
    roomName: (data.roomName as string) ?? null,
  };
}

/**
 * Producer LiveKit connection.
 *
 * Critical: never drop a token fetch due to a concurrent-call lock
 * (React Strict Mode was racing fetchInFlight → null → no LiveKitRoom →
 * agent alone in the room forever).
 */
export function LiveKitSessionProvider({
  sessionId,
  children,
}: {
  sessionId: string;
  children: ReactNode;
}) {
  const [creds, setCreds] = useState<TokenPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectKey, setConnectKey] = useState(0);
  const [phase, setPhase] = useState<
    "token" | "connecting" | "connected" | "error"
  >("token");

  const everConnected = useRef(false);
  const pageLeaving = useRef(false);
  const recoverAttempts = useRef(0);
  const recoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchGen = useRef(0);

  // Real page leave only (not React Strict Mode remount of children alone)
  useEffect(() => {
    const markLeave = () => {
      pageLeaving.current = true;
    };
    window.addEventListener("pagehide", markLeave);
    window.addEventListener("beforeunload", markLeave);
    return () => {
      window.removeEventListener("pagehide", markLeave);
      window.removeEventListener("beforeunload", markLeave);
      pageLeaving.current = true;
      if (recoverTimer.current) clearTimeout(recoverTimer.current);
    };
  }, []);

  // Initial + sessionId-change token fetch (Strict Mode safe)
  useEffect(() => {
    pageLeaving.current = false;
    everConnected.current = false;
    recoverAttempts.current = 0;
    const gen = ++fetchGen.current;
    let cancelled = false;

    void (async () => {
      try {
        setPhase("token");
        setError(null);
        const payload = await requestToken(sessionId);
        // Ignore stale responses from a cancelled Strict Mode pass
        if (cancelled || gen !== fetchGen.current) {
          console.info("[LiveKit] ignoring stale token response");
          return;
        }
        setCreds(payload);
        setPhase("connecting");
      } catch (e) {
        if (cancelled || gen !== fetchGen.current) return;
        console.error("[LiveKit] token fetch failed", e);
        setError(
          e instanceof Error ? e.message : "Failed to get voice token",
        );
        setPhase("error");
        setCreds(null);
      }
    })();

    return () => {
      cancelled = true;
      // Do NOT set pageLeaving here — Strict Mode remount must still connect
    };
  }, [sessionId]);

  const hardRecover = useCallback(async () => {
    if (pageLeaving.current) return;
    if (recoverAttempts.current >= 4) {
      setError("Voice connection lost — click retry");
      setPhase("error");
      return;
    }
    recoverAttempts.current += 1;
    setPhase("token");
    console.warn(`[LiveKit] hard recover #${recoverAttempts.current}`);

    try {
      const payload = await requestToken(sessionId);
      if (pageLeaving.current) return;
      setCreds(payload);
      setError(null);
      setPhase("connecting");
      setConnectKey((k) => k + 1);
    } catch (e) {
      console.error("[LiveKit] hard recover failed", e);
      setError(
        e instanceof Error ? e.message : "Reconnection failed — click retry",
      );
      setPhase("error");
    }
  }, [sessionId]);

  const onDisconnected = useCallback(
    (reason?: DisconnectReason) => {
      const name = DisconnectReason[reason ?? 0] ?? String(reason);
      console.info("[LiveKit] disconnected", name);
      if (pageLeaving.current) return;

      setPhase("connecting");
      if (recoverTimer.current) clearTimeout(recoverTimer.current);
      // Give soft client reconnect a moment; then re-token + remount
      recoverTimer.current = setTimeout(() => {
        if (pageLeaving.current) return;
        void hardRecover();
      }, everConnected.current ? 2000 : 3500);
    },
    [hardRecover],
  );

  const retry = () => {
    recoverAttempts.current = 0;
    pageLeaving.current = false;
    setError(null);
    void hardRecover();
  };

  if (phase === "error" && !creds) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-6">
        <p className="text-red-500 text-sm font-medium text-center">
          Voice Error: {error}
        </p>
        <p className="text-xs text-gray-500 text-center max-w-sm">
          Producer could not get a LiveKit token. Check you are signed in and
          LIVEKIT_API_KEY / SECRET are set in apps/web/.env.local
        </p>
        <button
          type="button"
          className="text-xs font-bold uppercase tracking-widest underline text-blue-600"
          onClick={retry}
        >
          Retry connection
        </button>
      </div>
    );
  }

  if (!creds) {
    return (
      <LiveKitReadyContext.Provider value={false}>
        <div className="relative h-full">
          <div className="absolute inset-x-0 top-3 z-20 flex justify-center pointer-events-none">
            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-full animate-pulse shadow-sm">
              Getting voice token…
            </span>
          </div>
          {children}
        </div>
      </LiveKitReadyContext.Provider>
    );
  }

  return (
    <LiveKitRoom
      key={`lk-${sessionId}-${connectKey}`}
      serverUrl={creds.url}
      token={creds.token}
      connect={true}
      audio={false}
      video={false}
      connectOptions={{
        autoSubscribe: true,
        maxRetries: 5,
        peerConnectionTimeout: 45_000,
        websocketTimeout: 30_000,
      }}
      options={{
        disconnectOnPageLeave: true,
        reconnectPolicy: {
          nextRetryDelayInMs: (ctx) => {
            if (ctx.retryCount > 10) return null;
            return Math.min(500 * 2 ** ctx.retryCount, 5000);
          },
        },
      }}
      onDisconnected={onDisconnected}
      onConnected={() => {
        console.info(
          "[LiveKit] PRODUCER CONNECTED room=",
          creds.roomName,
          "— agent should see remotes now",
        );
        everConnected.current = true;
        recoverAttempts.current = 0;
        setPhase("connected");
        setError(null);
      }}
      onError={(e) => {
        console.error("[LiveKit] room error", e);
        setError(e.message || "Room error");
      }}
      className="h-full relative"
    >
      <LiveKitReadyContext.Provider value={true}>
        <RoomAudioRenderer volume={0.65} />
        <MicController />
        <AgentPresenceGuard sessionId={sessionId} />

        {phase !== "connected" && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 px-3 py-1.5 rounded-full bg-blue-600 text-white text-[10px] font-bold uppercase tracking-widest shadow-lg animate-pulse">
            Connecting to room…
          </div>
        )}
        {error && phase === "connected" && (
          <div className="absolute bottom-3 left-3 z-50 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-[10px] font-bold max-w-xs">
            {error}
          </div>
        )}
        {children}
      </LiveKitReadyContext.Provider>
    </LiveKitRoom>
  );
}
