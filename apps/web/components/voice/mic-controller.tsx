"use client";

import { useEffect, useRef } from "react";
import {
  useConnectionState,
  useLocalParticipant,
} from "@livekit/components-react";
import { ConnectionState } from "livekit-client";

/**
 * On connect only: force mic OFF once for push-to-talk.
 * Does not fight the PTT button while the user is holding.
 */
export function MicController() {
  const connectionState = useConnectionState();
  const { localParticipant } = useLocalParticipant();
  const didInit = useRef(false);

  useEffect(() => {
    if (connectionState !== ConnectionState.Connected || !localParticipant) {
      didInit.current = false;
      return;
    }
    if (didInit.current) return;
    didInit.current = true;

    void (async () => {
      try {
        await localParticipant.setMicrophoneEnabled(false);
        console.info("[MicController] PTT ready — mic off by default");
      } catch (e) {
        console.error("[MicController] mute failed", e);
      }
    })();
  }, [connectionState, localParticipant]);

  return null;
}
