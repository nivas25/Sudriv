/**
 * Timeline & Segment Types
 * See: knowledge-base/04-data-models.md
 */

export type SegmentType =
  | "headlines"
  | "package"
  | "live"
  | "break"
  | "weather"
  | "sports"
  | "interview"
  | "closing";

export type SegmentStatus = "pending" | "on_air" | "completed" | "skipped";

export interface Segment {
  id: string;
  running_order_id: string;
  news_item_id: string | null;
  position: number;
  title: string;
  slug: string;
  segment_type: SegmentType;
  duration_seconds: number;
  start_offset_seconds: number;
  status: SegmentStatus;
  teleprompter_text: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface RunningOrder {
  id: string;
  session_id: string;
  version: number;
  total_duration_seconds: number;
  last_updated_at: string;
  created_at: string;
  segments?: Segment[];
}

export interface TimelineTemplate {
  id: string;
  name: string;
  description: string | null;
  default_duration_seconds: number;
  default_segments: DefaultSegment[];
  category: string;
  is_active: boolean;
  created_at: string;
}

export interface DefaultSegment {
  position: number;
  title: string;
  slug: string;
  segment_type: SegmentType;
  duration_seconds: number;
  teleprompter_text: string;
}

export type ProposalType =
  | "insert"
  | "remove"
  | "reorder"
  | "modify_duration"
  | "replace";

export type ProposalStatus =
  | "pending"
  | "confirmed"
  | "rejected"
  | "modified"
  | "expired";

export interface Proposal {
  id: string;
  session_id: string;
  proposal_type: ProposalType;
  proposed_changes: Record<string, unknown>;
  impact_analysis: ImpactAnalysis;
  status: ProposalStatus;
  producer_response: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface ImpactAnalysis {
  summary: string;
  affected_segments: AffectedSegment[];
  duration_change_seconds: number;
  new_total_duration: number;
  suggestions: string[];
}

export interface AffectedSegment {
  segment_id: string;
  title: string;
  old_position?: number;
  new_position?: number;
  old_start_offset?: number;
  new_start_offset?: number;
  delay_seconds?: number;
}

export interface AnchorInstruction {
  id: string;
  session_id: string;
  segment_id: string | null;
  instruction_text: string;
  instruction_type:
    | "transition"
    | "breaking"
    | "correction"
    | "timing"
    | "general";
  status: "pending" | "delivered" | "acknowledged";
  created_at: string;
}

export interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  content: string;
  category: string;
  priority: "critical" | "high" | "medium" | "low";
  estimated_duration_seconds: number;
  source: string;
  metadata: Record<string, unknown>;
  is_used: boolean;
  created_at: string;
}
