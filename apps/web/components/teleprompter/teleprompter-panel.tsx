"use client";

import { useState, useEffect } from "react";
import { FileText, MonitorPlay, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function TeleprompterPanel({ sessionId }: { sessionId: string }) {
  const [script, setScript] = useState("");
  const [title, setTitle] = useState("Loading...");
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (sessionId === "demo") {
      setLoading(false);
      return;
    }

    const loadActiveSegment = async () => {
      // 1. Fetch running order ID first
      const { data: roData } = await supabase
        .from("running_orders")
        .select("id")
        .eq("session_id", sessionId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!roData?.id) {
        setTitle("No active segment");
        setScript("Waiting for segments...");
        setLoading(false);
        return;
      }

      // 2. Find on_air segment
      let { data: segment } = await supabase
        .from("segments")
        .select("*")
        .eq("running_order_id", roData.id)
        .eq("status", "on_air")
        .limit(1)
        .maybeSingle();
        
      if (!segment) {
        // 3. Fallback to first pending segment
        const { data: pendingData } = await supabase
          .from("segments")
          .select("*")
          .eq("running_order_id", roData.id)
          .eq("status", "pending")
          .order("position", { ascending: true })
          .limit(1)
          .maybeSingle();
        segment = pendingData;
      }

      if (segment) {
        setTitle(`Segment ${String(segment.position).padStart(2, "0")}: ${segment.title}`);
        setScript(segment.teleprompter_text || "");
      } else {
        setTitle("No active segment");
        setScript("Waiting for segments...");
      }
      setLoading(false);
    };

    loadActiveSegment();

    const channel = supabase
      .channel(`teleprompter-${sessionId}`)
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

  const renderScript = () => {
    // Split by camera tags like [CAMERA 2 - WIDE SHOT]
    const parts = script.split(/(\[[^\]]+\])/);
    
    return parts.map((part, index) => {
      if (part.startsWith("[") && part.endsWith("]")) {
        return (
          <div key={index} className="flex items-center gap-3 py-3 px-4 bg-gray-50 border-l-2 border-primary rounded-r-md my-4">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
            <span className="text-xs font-bold tracking-widest uppercase text-gray-900">
              {part}
            </span>
          </div>
        );
      }
      return (
        <p key={index} className="text-base leading-relaxed text-gray-800 font-medium tracking-wide">
          {part}
        </p>
      );
    });
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden relative">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-white z-10">
        <div className="flex items-center gap-3">
          <MonitorPlay className="w-5 h-5 text-gray-400" />
          <h2 className="font-heading font-bold text-lg text-gray-900 tracking-tight">Anchor Script</h2>
        </div>
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-sm border border-red-200 bg-red-50">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
          <span className="text-[10px] font-bold text-red-700 uppercase tracking-widest">Live Output</span>
        </div>
      </div>

      {/* Script Text Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#fafcfd]">
        {loading ? (
           <div className="flex justify-center py-12">
             <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
           </div>
        ) : (
          <div className="max-w-2xl mx-auto flex flex-col gap-4">
            {/* Segment Title Badge */}
            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 bg-white border border-gray-200 shadow-sm rounded-md flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-gray-600">
                  {title}
                </span>
              </div>
            </div>
            
            {/* Script Content Card */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
              {renderScript()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
