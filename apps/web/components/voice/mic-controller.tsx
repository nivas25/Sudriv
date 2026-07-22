"use client";

import { useEffect, useRef, useState } from "react";
import {
  useConnectionState,
  useLocalParticipant,
  useRoomContext,
} from "@livekit/components-react";
import { ConnectionState, Track } from "livekit-client";

/**
 * Ensures the producer microphone is published into the LiveKit room.
 *
 * LiveKitRoom `audio={true}` can silently fail when:
 * - browser blocked auto-permission without a prior gesture
 * - OS mic is denied / wrong default device
 * - track published then immediately muted
 *
 * This controller re-enables the mic after connect and surfaces errors.
 */
export function MicController({
  onStatus,
}: {
  onStatus?: (status: MicStatus) => void;
}) {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const [status, setStatus] = useState<MicStatus>({
    state: "idle",
    message: "Waiting for room…",
  });
  const triedRef = useRef(false);

  useEffect(() => {
    onStatus?.(status);
  }, [status, onStatus]);

  useEffect(() => {
    if (connectionState !== ConnectionState.Connected || !localParticipant) {
      return;
    }

    let cancelled = false;

    async function enableMic() {
      // Already live with an actual mic track — nothing to do.
      const existing = localParticipant.getTrackPublication(Track.Source.Microphone);
      if (isMicrophoneEnabled && existing?.track && !existing.isMuted) {
        if (!cancelled) {
          setStatus({
            state: "live",
            message: "Microphone live",
            deviceLabel: existing.track.mediaStreamTrack?.label,
          });
        }
        return;
      }

      if (triedRef.current && isMicrophoneEnabled) return;
      triedRef.current = true;

      try {
        setStatus({ state: "requesting", message: "Requesting microphone permission…" });

        // Explicit getUserMedia first so the browser shows a clear permission prompt
        // and we can surface device errors before LiveKit publishes.
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
        // Stop the probe tracks — LiveKit will open its own capture.
        stream.getTracks().forEach((t) => t.stop());

        if (cancelled) return;

        await localParticipant.setMicrophoneEnabled(true, {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        });

        const pub = localParticipant.getTrackPublication(Track.Source.Microphone);
        const label = pub?.track?.mediaStreamTrack?.label;

        if (!cancelled) {
          setStatus({
            state: "live",
            message: label ? `Mic: ${label}` : "Microphone live",
            deviceLabel: label,
          });
          console.log("[MicController] Microphone enabled", {
            identity: localParticipant.identity,
            trackSid: pub?.trackSid,
            label,
          });
        }
      } catch (err) {
        const message =
          err instanceof DOMException && err.name === "NotAllowedError"
            ? "Microphone blocked — allow mic access in the browser address bar, then reload."
            : err instanceof DOMException && err.name === "NotFoundError"
              ? "No microphone found — plug in a mic or select one in Windows sound settings."
              : err instanceof Error
                ? err.message
                : "Failed to enable microphone";

        console.error("[MicController] Failed to enable mic:", err);
        if (!cancelled) {
          setStatus({ state: "error", message });
        }
      }
    }

    void enableMic();

    return () => {
      cancelled = true;
    };
  }, [connectionState, localParticipant, isMicrophoneEnabled, room]);

  // Keep status in sync if user mutes via UI
  useEffect(() => {
    if (connectionState !== ConnectionState.Connected) return;
    if (status.state === "error" || status.state === "requesting") return;

    if (isMicrophoneEnabled) {
      const pub = localParticipant?.getTrackPublication(Track.Source.Microphone);
      setStatus({
        state: "live",
        message: pub?.track?.mediaStreamTrack?.label
          ? `Mic: ${pub.track.mediaStreamTrack.label}`
          : "Microphone live",
        deviceLabel: pub?.track?.mediaStreamTrack?.label,
      });
    } else if (status.state === "live") {
      setStatus({ state: "muted", message: "Microphone muted — tap the mic button to speak" });
    }
  }, [isMicrophoneEnabled, connectionState, localParticipant, status.state]);

  return null;
}

export type MicStatus = {
  state: "idle" | "requesting" | "live" | "muted" | "error";
  message: string;
  deviceLabel?: string;
};
