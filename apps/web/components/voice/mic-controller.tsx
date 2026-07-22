"use client";

import { useEffect, useRef } from "react";
import {
  useConnectionState,
  useLocalParticipant,
} from "@livekit/components-react";
import { ConnectionState } from "livekit-client";

/**
 * On each successful room connect: force mic OFF once for push-to-talk.
 * Tracks identity so soft reconnects that keep the same participant don't
 * thrash the mic while the producer is holding PTT.
 */
export function MicController() {
  const connectionState = useConnectionState();
  const { localParticipant } = useLocalParticipant();
  const primedFor = useRef<string | null>(null);

  useEffect(() => {
    if (connectionState !== ConnectionState.Connected || !localParticipant) {
      return;
    }
    const id = localParticipant.identity || "local";
    if (primedFor.current === id) return;
    primedFor.current = id;

    void (async () => {
      try {
        await localParticipant.setMicrophoneEnabled(false);
        console.info("[MicController] PTT ready — mic off by default");
      } catch (e) {
        console.error("[MicController] mute failed", e);
      }
    })();
  }, [connectionState, localParticipant]);

  // Allow re-prime after a full disconnect so hard recovery gets a clean mic.
  useEffect(() => {
    if (connectionState === ConnectionState.Disconnected) {
      primedFor.current = null;
    }
  }, [connectionState]);

  return null;
}
