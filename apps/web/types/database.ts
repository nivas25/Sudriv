/**
 * Database Types (Auto-generated placeholder)
 *
 * TODO: Replace with auto-generated types from Supabase CLI:
 *   npx supabase gen types typescript --project-id <id> > types/database.ts
 *
 * See: knowledge-base/04-data-models.md for full schema
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          display_name: string;
          role: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["users"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
      };
      timelines_library: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          default_duration_seconds: number;
          default_segments: Json;
          category: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["timelines_library"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["timelines_library"]["Insert"]>;
      };
      sessions: {
        Row: {
          id: string;
          user_id: string;
          timeline_template_id: string | null;
          status: "setup" | "active" | "paused" | "ended";
          livekit_room_name: string | null;
          config: Json;
          started_at: string | null;
          ended_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["sessions"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["sessions"]["Insert"]>;
      };
      running_orders: {
        Row: {
          id: string;
          session_id: string;
          version: number;
          total_duration_seconds: number;
          last_updated_at: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["running_orders"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["running_orders"]["Insert"]>;
      };
      segments: {
        Row: {
          id: string;
          running_order_id: string;
          news_item_id: string | null;
          position: number;
          title: string;
          slug: string;
          segment_type: string;
          duration_seconds: number;
          start_offset_seconds: number;
          status: "pending" | "on_air" | "completed" | "skipped";
          teleprompter_text: string;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["segments"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["segments"]["Insert"]>;
      };
      news_items: {
        Row: {
          id: string;
          headline: string;
          summary: string;
          content: string;
          category: string;
          priority: "critical" | "high" | "medium" | "low";
          estimated_duration_seconds: number;
          source: string;
          metadata: Json;
          is_used: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["news_items"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["news_items"]["Insert"]>;
      };
      proposals: {
        Row: {
          id: string;
          session_id: string;
          proposal_type: "insert" | "remove" | "reorder" | "modify_duration" | "replace";
          proposed_changes: Json;
          impact_analysis: Json;
          status: "pending" | "confirmed" | "rejected" | "modified" | "expired";
          producer_response: string | null;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["proposals"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["proposals"]["Insert"]>;
      };
      anchor_instructions: {
        Row: {
          id: string;
          session_id: string;
          segment_id: string | null;
          instruction_text: string;
          instruction_type: "transition" | "breaking" | "correction" | "timing" | "general";
          status: "pending" | "delivered" | "acknowledged";
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["anchor_instructions"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["anchor_instructions"]["Insert"]>;
      };
      session_events: {
        Row: {
          id: string;
          session_id: string;
          event_type: string;
          payload: Json;
          source: "producer" | "agent" | "system" | "manual_ui";
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["session_events"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["session_events"]["Insert"]>;
      };
    };
  };
}
