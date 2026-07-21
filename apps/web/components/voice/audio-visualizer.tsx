"use client";

/**
 * AudioVisualizer — Waveform / audio level display
 *
 * TODO: Replace with @livekit/components-react BarVisualizer
 */
export function AudioVisualizer() {
  return (
    <div className="flex gap-0.5 h-8 items-end">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="w-1.5 bg-primary/40 rounded-full transition-all"
          style={{ height: "8px" }}
        />
      ))}
    </div>
  );
}
