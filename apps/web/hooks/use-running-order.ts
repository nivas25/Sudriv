"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useRunningOrder(sessionId: string) {
  const [segments, setSegments] = useState<any[]>([]);
  const [totalDuration, setTotalDuration] = useState(0);
  const [version, setVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // If we're on the demo route, skip real data fetch
    if (sessionId === "demo") {
      setIsLoading(false);
      return;
    }

    const supabase = createClient();

    const loadInitial = async () => {
      const { data: ro } = await supabase
        .from("running_orders")
        .select("*, segments(*)")
        .eq("session_id", sessionId)
        .order("version", { ascending: false })
        .limit(1)
        .single();

      if (ro) {
        setSegments(ro.segments.sort((a: any, b: any) => a.position - b.position));
        setTotalDuration(ro.total_duration_seconds);
        setVersion(ro.version);
      }
      setIsLoading(false);
    };
    
    loadInitial();

    const channel = supabase
      .channel(`running-order-${sessionId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "running_orders",
        filter: `session_id=eq.${sessionId}`,
      }, async (payload) => {
        loadInitial();
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "segments",
      }, async (payload) => {
        loadInitial();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  return { segments, totalDuration, version, isLoading };
}
