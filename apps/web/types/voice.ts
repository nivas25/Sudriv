/**
 * Voice & Agent Types
 * See: knowledge-base/05-voice-agent-design.md
 */

/** Voice assistant connection states */
export type AgentState =
  | "disconnected"
  | "connecting"
  | "idle"
  | "listening"
  | "thinking"
  | "speaking";

/** Voice panel props */
export interface VoicePanelProps {
  sessionId: string;
}

/** Transcript entry from STT */
export interface TranscriptEntry {
  id: string;
  speaker: "producer" | "agent";
  text: string;
  timestamp: string;
  isFinal: boolean;
}
