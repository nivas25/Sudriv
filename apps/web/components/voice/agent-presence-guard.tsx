"use client";

import { useEffect, useRef } from "react";
import {
  useConnectionState,
  useVoiceAssistant,
  useRemoteParticipants,
  useRoomContext,
} from "@livekit/components-react";
import { ConnectionState, RoomEvent, ParticipantKind } from "livekit-client";

/**
 * Re-dispatch the agent only when:
 *  - producer room is Connected
 *  - no agent participant is in the room
 *  - we previously had an agent (mid-session drop), OR initial join waited long enough
 *
 * Does NOT fire while an agent is present but still "connecting" (no state
 * attribute yet) — that is normal during session startup.
 */
export function AgentPresenceGuard({ sessionId }: { sessionId: string }) {
  const connectionState = useConnectionState();
  const { agent } = useVoiceAssistant();
  const remotes = useRemoteParticipants();
  const room = useRoomContext();
  const ensuringRef = useRef(false);
  const lastEnsureRef = useRef(0);
  const hadAgentRef = useRef(false);
  const mountedAt = useRef(Date.now());

  // Any remote agent participant counts (even without lk.agent.state yet)
  const agentInRoom =
    Boolean(agent) ||
    remotes.some(
      (p) =>
        p.kind === ParticipantKind.AGENT ||
        (p.identity || "").toLowerCase().includes("agent"),
    );

  useEffect(() => {
    if (agentInRoom) hadAgentRef.current = true;
  }, [agentInRoom]);

  useEffect(() => {
    if (!room) return;
    const onLeave = (participant: {
      kind?: ParticipantKind;
      identity?: string;
    }) => {
      if (
        participant.kind === ParticipantKind.AGENT ||
        (participant.identity || "").toLowerCase().includes("agent")
      ) {
        console.warn("[AgentPresence] agent left:", participant.identity);
      }
    };
    room.on(RoomEvent.ParticipantDisconnected, onLeave);
    return () => {
      room.off(RoomEvent.ParticipantDisconnected, onLeave);
    };
  }, [room]);

  useEffect(() => {
    if (connectionState !== ConnectionState.Connected) return;
    if (agentInRoom) return;

    // Initial join: give token roomConfig dispatch + worker start more time.
    // Mid-session drop: recover faster.
    const age = Date.now() - mountedAt.current;
    const graceMs = hadAgentRef.current ? 4000 : Math.max(12000 - age, 10000);

    const timer = setTimeout(() => {
      void ensureAgent();
    }, graceMs);

    return () => clearTimeout(timer);

    async function ensureAgent() {
      const now = Date.now();
      if (ensuringRef.current || now - lastEnsureRef.current < 15_000) return;
      ensuringRef.current = true;
      lastEnsureRef.current = now;
      try {
        console.info(
          "[AgentPresence] ensuring agent for session",
          sessionId.slice(0, 8),
        );
        const res = await fetch("/api/livekit/ensure-agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          console.error("[AgentPresence] ensure-agent failed", data);
        } else {
          console.info("[AgentPresence] ensure-agent ok", data);
        }
      } catch (e) {
        console.error("[AgentPresence] ensure-agent error", e);
      } finally {
        ensuringRef.current = false;
      }
    }
  }, [agentInRoom, connectionState, sessionId]);

  return null;
}
