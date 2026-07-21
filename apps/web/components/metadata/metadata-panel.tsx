"use client";

import { useState, useEffect } from "react";
import { FileText, Clock, Info, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDuration } from "@/lib/utils";

export function MetadataPanel({ sessionId }: { sessionId: string }) {
  const [segment, setSegment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (sessionId === "demo") {
      setLoading(false);
      return;
    }

    const loadActiveSegment = async () => {
      // Find on_air segment first
      let { data: activeSeg } = await supabase
        .from("segments")
        .select("*")
        .eq("running_order_id", (
           await supabase.from("running_orders").select("id").eq("session_id", sessionId).order("version", { ascending: false }).limit(1).single()
        ).data?.id || "")
        .eq("status", "on_air")
        .limit(1)
        .single();
        
      if (!activeSeg) {
        // Fallback to first pending segment
        const { data: pendingData } = await supabase
          .from("segments")
          .select("*")
          .eq("running_order_id", (
             await supabase.from("running_orders").select("id").eq("session_id", sessionId).order("version", { ascending: false }).limit(1).single()
          ).data?.id || "")
          .eq("status", "pending")
          .order("position", { ascending: true })
          .limit(1)
          .single();
        activeSeg = pendingData;
      }

      setSegment(activeSeg);
      setLoading(false);
    };

    loadActiveSegment();

    const channel = supabase
      .channel(`metadata-${sessionId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "segments"
      }, () => {
        loadActiveSegment();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100 bg-white">
        <FileText className="w-5 h-5 text-gray-400" />
        <h2 className="font-heading font-bold text-lg text-gray-900 tracking-tight">Active Context</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
          </div>
        ) : !segment ? (
          <div className="flex justify-center py-12 text-sm text-gray-500 font-bold uppercase tracking-widest">
            No active context
          </div>
        ) : (
          <>
            {/* Current Segment Info */}
            <div className="flex flex-col gap-1.5 pb-5 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  Segment {String(segment.position).padStart(2, "0")}
                </h3>
                {segment.status === "on_air" ? (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-red-600 rounded-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>
                    <span className="text-[9px] font-bold text-white uppercase tracking-widest">Live</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-gray-200 rounded-sm">
                    <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">Pending</span>
                  </div>
                )}
              </div>
              <p className="font-semibold text-base text-gray-900">{segment.title}</p>
              <div className="flex items-center gap-2 text-xs font-medium text-gray-500 mt-1">
                <Clock className="w-3.5 h-3.5" />
                <span className="font-heading tabular-nums">{formatDuration(segment.duration_seconds)} Estimated</span>
              </div>
            </div>

            {/* AI Briefing Notes */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
                <Info className="w-4 h-4" />
                Copilot Alert
              </div>
              <div className="p-4 rounded-lg bg-red-50/50 border border-red-100/50">
                <p className="text-sm font-medium text-gray-800 leading-relaxed">
                  Monitoring segment flow. Teleprompter is synced. Waiting for further commands.
                </p>
              </div>
            </div>

            {/* Key Facts */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Segment Metadata</h3>
              <ul className="space-y-2.5">
                <li className="flex items-start gap-3 text-sm text-gray-700">
                  <div className="w-1.5 h-1.5 rounded-sm bg-gray-400 mt-1.5 shrink-0"></div>
                  <span className="leading-tight">Type: <strong className="text-gray-900 uppercase">{segment.segment_type}</strong></span>
                </li>
                {segment.metadata && Object.entries(segment.metadata).map(([key, value]) => (
                  <li key={key} className="flex items-start gap-3 text-sm text-gray-700">
                    <div className="w-1.5 h-1.5 rounded-sm bg-gray-400 mt-1.5 shrink-0"></div>
                    <span className="leading-tight">{key}: <strong className="text-gray-900">{String(value)}</strong></span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
