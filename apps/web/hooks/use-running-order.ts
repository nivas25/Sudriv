"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Live running order for a session.
 *
 * Agent updates via:
 *   UPDATE running_orders (version / duration)
 *   DELETE + INSERT segments
 * so we must listen for UPDATE + INSERT + DELETE, not only INSERT on RO.
 */
export function useRunningOrder(sessionId: string) {
  const [segments, setSegments] = useState<any[]>([]);
  const [totalDuration, setTotalDuration] = useState(0);
  const [version, setVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const loadInitial = useCallback(async () => {
    if (sessionId === "demo") {
      setIsLoading(false);
      return;
    }

    const supabase = createClient();
    const { data: ro } = await supabase
      .from("running_orders")
      .select("*, segments(*)")
      .eq("session_id", sessionId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ro) {
      const segs = Array.isArray(ro.segments)
        ? [...ro.segments].sort((a: any, b: any) => a.position - b.position)
        : [];
      setSegments(segs);
      setTotalDuration(ro.total_duration_seconds ?? 0);
      setVersion(ro.version ?? 0);
    }
    setIsLoading(false);
  }, [sessionId]);

  useEffect(() => {
    if (sessionId === "demo") {
      setIsLoading(false);
      return;
    }

    void loadInitial();

    const supabase = createClient();
    const channel = supabase
      .channel(`running-order-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "running_orders",
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          void loadInitial();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "segments",
        },
        () => {
          // Segment rows don't carry session_id — reload latest RO for this session.
          void loadInitial();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sessionId, loadInitial]);

  return { segments, totalDuration, version, isLoading, reload: loadInitial };
}
