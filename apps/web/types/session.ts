/**
 * Session Types
 * See: knowledge-base/04-data-models.md
 */

export type SessionStatus = "setup" | "active" | "paused" | "ended";

export interface Session {
  id: string;
  user_id: string;
  timeline_template_id: string | null;
  status: SessionStatus;
  livekit_room_name: string | null;
  config: SessionConfig;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionConfig {
  newsCategory?: string;
  // TODO: Add additional session config fields as needed
}

export interface SessionSummary {
  sessionId: string;
  durationMinutes: number;
  totalEvents: number;
  proposalsCreated: number;
  proposalsConfirmed: number;
  proposalsRejected: number;
  anchorInstructions: number;
  runningOrderChanges: number;
}
