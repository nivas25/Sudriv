"use client";

import { useState, useEffect } from "react";
import { formatDuration } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

/**
 * SessionControls — Top bar during active session
 * Shows session name, elapsed time, total duration, and end button.
 */
export function SessionControls({ sessionId }: { sessionId: string }) {
  const [elapsed, setElapsed] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (sessionId === "demo") return;

    const loadSession = async () => {
      // Get session details
      const { data: session } = await supabase
        .from("sessions")
        .select("started_at, created_at, timeline_template_id")
        .eq("id", sessionId)
        .single();

      if (session) {
        setStartedAt(session.started_at || session.created_at);

        // Get total duration from running order
        const { data: ro } = await supabase
          .from("running_orders")
          .select("total_duration_seconds")
          .eq("session_id", sessionId)
          .order("version", { ascending: false })
          .limit(1)
          .single();

        if (ro) {
          setTotalDuration(ro.total_duration_seconds);
        }
      }
    };

    loadSession();
  }, [sessionId]);

  // Live elapsed timer
  useEffect(() => {
    if (!startedAt) return;

    const start = new Date(startedAt).getTime();
    const tick = () => {
      const now = Date.now();
      setElapsed(Math.floor((now - start) / 1000));
    };

    tick(); // initial
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  return (
    <div className="h-14 px-6 flex items-center justify-between bg-gray-900 border-b border-gray-950 shadow-md z-10">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1 bg-red-600 rounded-sm">
          <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
          <span className="text-[11px] font-bold text-white uppercase tracking-widest">Live Control</span>
        </div>
        <span className="text-xs font-medium text-gray-400 font-mono tracking-wide hidden sm:inline">
          ID: {sessionId.slice(0, 8).toUpperCase()}
        </span>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3 bg-black/50 px-4 py-1.5 rounded-sm border border-white/10">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Elapsed</span>
          <span className="text-sm font-heading font-medium text-white tabular-nums">{formatDuration(elapsed)}</span>
          <span className="text-gray-600">/</span>
          <span className="text-sm font-heading font-medium text-gray-400 tabular-nums">{formatDuration(totalDuration)}</span>
        </div>
      </div>
    </div>
  );
}
