"use client";

/**
 * VoicePanel — Voice status + controls bar
 *
 * Bottom bar in the session layout.
 * Shows agent connection status, audio visualizer, and mic controls.
 *
 * See: knowledge-base/07-frontend-architecture.md (Voice Panel Component)
 *
 * TODO:
 * - Connect to LiveKit room using useLiveKitToken hook
 * - Use @livekit/components-react for voice assistant UI
 * - Show agent state (listening/thinking/speaking)
 * - Add audio visualizer (BarVisualizer)
 * - Add mic mute/unmute controls
 * - Show live transcript
 */
export function VoicePanel({ sessionId }: { sessionId: string }) {
  // TODO: Replace with LiveKitRoom + useVoiceAssistant integration
  // See knowledge-base/07-frontend-architecture.md for full implementation

  return (
    <div className="panel p-3 flex items-center gap-4">
      {/* Agent Status */}
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">
          Voice: Disconnected
        </span>
      </div>

      {/* Audio Visualizer Placeholder */}
      <div className="flex-1 flex items-center justify-center">
        <div className="flex gap-1 h-6 items-end">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="w-1 bg-muted-foreground/30 rounded-full"
              style={{ height: `${8 + Math.random() * 16}px` }}
            />
          ))}
        </div>
      </div>

      {/* Transcript Preview */}
      <div className="flex-1 text-sm text-muted-foreground italic truncate">
        Connect to start voice interaction...
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          className="px-3 py-1.5 text-xs bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
          disabled
        >
          🎙 Mute
        </button>
      </div>
    </div>
  );
}
