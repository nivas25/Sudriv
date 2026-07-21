"use client";

import type { TranscriptEntry } from "@/types/voice";

/**
 * TranscriptDisplay — Live conversation transcript
 *
 * TODO: Show real-time STT output and agent responses
 */
export function TranscriptDisplay({
  entries,
}: {
  entries: TranscriptEntry[];
}) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        Transcript will appear here...
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {entries.map((entry) => (
        <div key={entry.id} className="text-sm">
          <span className="font-medium text-xs text-muted-foreground mr-1">
            {entry.speaker === "producer" ? "You:" : "AI:"}
          </span>
          <span className={entry.isFinal ? "" : "text-muted-foreground italic"}>
            {entry.text}
          </span>
        </div>
      ))}
    </div>
  );
}
