"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  MessageSquare,
  Mic,
  MicOff,
  User,
  Cpu,
  Loader2,
  Volume2,
  AlertCircle,
} from "lucide-react";
import {
  useRoomContext,
  useConnectionState,
  useLocalParticipant,
  useVoiceAssistant,
} from "@livekit/components-react";
import {
  ConnectionState,
  RoomEvent,
  Track,
  type TranscriptionSegment,
} from "livekit-client";
import { useLiveKitReady } from "@/components/voice/livekit-session-provider";

interface Message {
  id: string;
  role: "human" | "ai";
  text: string;
  timestamp: Date;
}

const MIC_OPTS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
} as const;

export function TranscriptPanel({ sessionId }: { sessionId: string }) {
  const ready = useLiveKitReady();
  if (!ready) return <TranscriptPanelDisconnected />;
  return <TranscriptPanelConnected sessionId={sessionId} />;
}

function TranscriptPanelDisconnected() {
  return (
    <div className="flex flex-col h-full bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-5 h-5 text-gray-400" />
          <h2 className="font-heading font-bold text-lg text-gray-900 tracking-tight">
            AI Copilot Feed
          </h2>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-sm bg-amber-500 shadow-sm">
          <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <span className="text-[10px] font-bold text-white uppercase tracking-widest">
            Connecting…
          </span>
        </div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 text-gray-300 animate-spin" />
        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">
          Preparing voice connection…
        </p>
      </div>
    </div>
  );
}

function TranscriptPanelConnected({ sessionId }: { sessionId: string }) {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const { state: agentState } = useVoiceAssistant();

  const [messages, setMessages] = useState<Message[]>([]);
  const [micError, setMicError] = useState<string | null>(null);
  const [holding, setHolding] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const holdingRef = useRef(false);
  const pttBusyRef = useRef(false);

  const isConnected = connectionState === ConnectionState.Connected;

  const setMic = useCallback(
    async (enabled: boolean) => {
      if (!localParticipant || pttBusyRef.current) return;
      pttBusyRef.current = true;
      setMicError(null);
      try {
        if (enabled) {
          // Permission prompt on first press
          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              audio: true,
            });
            stream.getTracks().forEach((t) => t.stop());
          } catch (permErr) {
            const msg =
              permErr instanceof DOMException && permErr.name === "NotAllowedError"
                ? "माइक अनुमति दें (browser address bar → Microphone → Allow)"
                : permErr instanceof DOMException && permErr.name === "NotFoundError"
                  ? "कोई माइक्रोफ़ोन नहीं मिला"
                  : "माइक चालू नहीं हो सका";
            setMicError(msg);
            return;
          }
        }

        await localParticipant.setMicrophoneEnabled(enabled, MIC_OPTS);
        console.info("[PTT]", enabled ? "mic ON (hold)" : "mic OFF (release)", {
          sessionId: sessionId.slice(0, 8),
        });
      } catch (e) {
        console.error("[PTT] failed", e);
        setMicError(e instanceof Error ? e.message : "Mic error");
      } finally {
        pttBusyRef.current = false;
      }
    },
    [localParticipant, sessionId],
  );

  const startPtt = useCallback(
    (e: React.PointerEvent | React.TouchEvent) => {
      e.preventDefault();
      if (!isConnected || holdingRef.current) return;
      holdingRef.current = true;
      setHolding(true);
      void setMic(true);
    },
    [isConnected, setMic],
  );

  const endPtt = useCallback(
    (e?: React.PointerEvent | React.TouchEvent) => {
      e?.preventDefault();
      if (!holdingRef.current) return;
      holdingRef.current = false;
      setHolding(false);
      void setMic(false);
    },
    [setMic],
  );

  // Safety: release on window blur / pointer cancel
  useEffect(() => {
    const release = () => {
      if (holdingRef.current) {
        holdingRef.current = false;
        setHolding(false);
        void setMic(false);
      }
    };
    window.addEventListener("blur", release);
    window.addEventListener("pointerup", release);
    return () => {
      window.removeEventListener("blur", release);
      window.removeEventListener("pointerup", release);
    };
  }, [setMic]);

  // Transcripts: only accept producer text while PTT is held (or just released within 1.5s)
  const lastPttEndRef = useRef(0);
  useEffect(() => {
    if (!holding) lastPttEndRef.current = Date.now();
  }, [holding]);

  useEffect(() => {
    if (!room) return;

    const handleTranscription = (
      segments: TranscriptionSegment[],
      participant: { identity?: string } | undefined,
    ) => {
      for (const segment of segments) {
        const text = segment.text?.trim();
        if (!text || !segment.final) continue;

        const isProducer = Boolean(
          participant?.identity?.startsWith("producer"),
        );
        const role: "human" | "ai" = isProducer ? "human" : "ai";

        // Block producer ghost transcripts when mic is not held
        if (role === "human") {
          const recentHold =
            holdingRef.current || Date.now() - lastPttEndRef.current < 1500;
          if (!recentHold) {
            console.info("[Transcript] ignored (mic not held)", text.slice(0, 40));
            continue;
          }
        }

        setMessages((prev) => {
          const byId = prev.findIndex((m) => m.id === segment.id);
          if (byId >= 0) {
            const next = [...prev];
            next[byId] = { ...next[byId], text };
            return next;
          }

          const last = prev[prev.length - 1];
          const sameTurn =
            last &&
            last.role === role &&
            Date.now() - last.timestamp.getTime() < 8000;

          if (sameTurn) {
            let nextText = text;
            if (text.startsWith(last.text)) nextText = text;
            else if (last.text.startsWith(text)) nextText = last.text;
            else if (!last.text.includes(text))
              nextText = `${last.text} ${text}`.replace(/\s+/g, " ").trim();
            else nextText = last.text;
            return [
              ...prev.slice(0, -1),
              {
                ...last,
                id: segment.id,
                text: nextText,
                timestamp: new Date(),
              },
            ];
          }

          return [
            ...prev,
            { id: segment.id, role, text, timestamp: new Date() },
          ];
        });
      }
    };

    room.on(RoomEvent.TranscriptionReceived, handleTranscription);
    return () => {
      room.off(RoomEvent.TranscriptionReceived, handleTranscription);
    };
  }, [room]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const statusColor = isConnected
    ? holding || isMicrophoneEnabled
      ? "bg-emerald-600"
      : "bg-gray-500"
    : connectionState === ConnectionState.Connecting
      ? "bg-amber-500"
      : "bg-gray-400";

  const statusText = !isConnected
    ? connectionState === ConnectionState.Connecting
      ? "Connecting…"
      : "Disconnected"
    : holding
      ? "Push-to-talk"
      : "Hold mic to talk";

  const agentLabel =
    agentState === "listening"
      ? "Agent listening"
      : agentState === "thinking"
        ? "Agent thinking"
        : agentState === "speaking"
          ? "Agent speaking"
          : "Agent idle";

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden select-none">
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-5 h-5 text-gray-400" />
          <h2 className="font-heading font-bold text-lg text-gray-900 tracking-tight">
            AI Copilot Feed
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hidden sm:inline">
            {agentLabel}
          </span>
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-sm ${statusColor} shadow-sm`}
          >
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-[10px] font-bold text-white uppercase tracking-widest">
              {statusText}
            </span>
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-8 bg-gray-50/30"
      >
        {micError && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-100 text-red-700">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-sm font-medium leading-relaxed">{micError}</div>
          </div>
        )}

        {!isConnected ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            {connectionState === ConnectionState.Connecting ? (
              <>
                <Loader2 className="w-8 h-8 text-gray-300 animate-spin" />
                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                  Connecting…
                </p>
              </>
            ) : (
              <>
                <Volume2 className="w-8 h-8 text-gray-300" />
                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                  Waiting for connection…
                </p>
              </>
            )}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 px-6 text-center">
            <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">
              Press & hold mic to speak
            </p>
            <p className="text-xs text-gray-400 max-w-sm leading-relaxed">
              माइक बटन दबाकर रखें, बोलें, छोड़ दें। माइक हमेशा बंद रहता है जब तक
              आप दबाते नहीं।
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "human" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`flex gap-4 max-w-[85%] ${
                  msg.role === "human" ? "flex-row-reverse" : "flex-row"
                }`}
              >
                <div className="flex-shrink-0">
                  <div
                    className={`w-8 h-8 flex items-center justify-center rounded-sm border-2 ${
                      msg.role === "human"
                        ? "bg-primary text-white border-primary shadow-sm"
                        : "bg-gray-900 text-white border-gray-900 shadow-sm"
                    }`}
                  >
                    {msg.role === "human" ? (
                      <User className="w-4 h-4" />
                    ) : (
                      <Cpu className="w-4 h-4" />
                    )}
                  </div>
                </div>
                <div
                  className={`flex flex-col ${
                    msg.role === "human" ? "items-end" : "items-start"
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                    {msg.role === "human" ? "Producer" : "Sudriv AI"}
                  </span>
                  <div
                    className={`px-5 py-3.5 border shadow-sm ${
                      msg.role === "human"
                        ? "bg-white border-primary/20 text-gray-900 rounded-2xl rounded-tr-sm"
                        : "bg-white border-gray-200 text-gray-900 rounded-2xl rounded-tl-sm"
                    }`}
                  >
                    <p className="text-sm font-medium leading-relaxed">{msg.text}</p>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Push-to-talk control */}
      <div className="p-4 sm:p-6 bg-white border-t border-gray-100 flex flex-col items-center justify-center gap-3">
        <button
          type="button"
          disabled={!isConnected}
          onPointerDown={startPtt}
          onPointerUp={endPtt}
          onPointerLeave={endPtt}
          onPointerCancel={endPtt}
          onContextMenu={(e) => e.preventDefault()}
          style={{ touchAction: "none" }}
          aria-pressed={holding}
          aria-label="Hold to talk"
          className={`flex items-center justify-center w-20 h-20 rounded-full shadow-lg transition-all relative touch-none ${
            !isConnected
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : holding
                ? "bg-emerald-600 text-white shadow-emerald-600/40 scale-110"
                : "bg-gray-900 text-white hover:bg-gray-800"
          }`}
        >
          {holding && (
            <div className="absolute inset-0 rounded-full border-2 border-emerald-300 animate-ping opacity-50" />
          )}
          {holding ? <Mic className="w-7 h-7" /> : <MicOff className="w-7 h-7" />}
        </button>
        <span
          className={`text-[10px] font-bold uppercase tracking-widest ${
            !isConnected
              ? "text-gray-300"
              : holding
                ? "text-emerald-600 animate-pulse"
                : "text-gray-400"
          }`}
        >
          {!isConnected
            ? "Not connected"
            : holding
              ? "Listening — release when done"
              : "Hold to talk · Push-to-talk"}
        </span>
      </div>
    </div>
  );
}
