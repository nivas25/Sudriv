"use client";

import { useRunningOrder } from "@/hooks/use-running-order";
import { formatDuration } from "@/lib/utils";
import { Radio, Loader2, MonitorPlay, FastForward } from "lucide-react";

export function LiveProducerFeed({ sessionId }: { sessionId: string }) {
  const {
    activeSegment,
    segments,
    version,
    isLoading,
    isRefreshing,
  } = useRunningOrder(sessionId);

  const title = activeSegment?.title ?? "No active segment";
  const duration = activeSegment?.duration_seconds ?? 0;
  const type = activeSegment?.segment_type ?? "N/A";
  
  const rawScript = activeSegment?.teleprompter_text?.trim() ?? "";
  const script = rawScript || (isLoading ? "" : activeSegment ? `(No script for “${activeSegment.title}”)` : "Waiting for feed...");

  // Find the next segment
  const nextSegment = activeSegment 
    ? segments.find(s => s.position === activeSegment.position + 1)
    : segments.length > 0 ? segments[0] : null;

  const renderScript = () => {
    // Split by [ANCHOR CUE] tags to highlight them
    const parts = script.split(/(\[ANCHOR CUE\][^\[]*)/);
    return parts.map((part, index) => {
      if (part.startsWith("[ANCHOR CUE]")) {
        const text = part.replace("[ANCHOR CUE]", "").trim();
        return (
          <div key={index} className="my-6 px-5 py-4 bg-amber-500/10 border-l-4 border-amber-500 rounded-r-lg relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <p className="text-amber-400 font-bold text-sm tracking-widest uppercase mb-1 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Agent Cue
            </p>
            <p className="text-amber-50 text-lg leading-relaxed font-medium">{text}</p>
          </div>
        );
      }
      
      // Standard tags like [LIVE] or [BREAKING]
      const subParts = part.split(/(\[[^\]]+\])/);
      return subParts.map((sub, sIdx) => {
        if (sub.startsWith("[") && sub.endsWith("]")) {
          return (
            <span key={`tag-${index}-${sIdx}`} className="inline-block mx-1 px-2 py-0.5 bg-zinc-800 text-zinc-300 text-xs font-bold uppercase tracking-widest rounded border border-zinc-700">
              {sub}
            </span>
          );
        }
        if (!sub.trim()) return null;
        return (
          <p key={`text-${index}-${sIdx}`} className="text-2xl leading-[1.6] text-zinc-100 font-medium mb-4 whitespace-pre-wrap">
            {sub}
          </p>
        );
      });
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0b] rounded-3xl shadow-2xl border border-zinc-800/80 overflow-hidden relative text-zinc-100">
      
      {/* Top Glass Bar */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800/50 bg-[#0a0a0b]/80 backdrop-blur-xl z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-full">
            <Radio className="w-4 h-4 text-red-500 animate-pulse" />
            <span className="text-[11px] font-bold text-red-500 uppercase tracking-widest">On Air</span>
          </div>
          <h2 className="font-heading font-extrabold text-xl tracking-tight text-white flex items-center gap-3">
            Live Monitor
            {version > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-zinc-800 text-zinc-400 tabular-nums">
                v{version}
              </span>
            )}
          </h2>
        </div>
        
        {isRefreshing && <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />}
      </div>

      {/* Main HUD */}
      <div className="flex-1 overflow-y-auto bg-gradient-to-b from-[#0a0a0b] to-[#121214] p-6 lg:p-8 custom-scrollbar relative">
        {isLoading ? (
           <div className="flex justify-center items-center h-full">
             <Loader2 className="w-8 h-8 animate-spin text-zinc-600" />
           </div>
        ) : (
          <div className="max-w-4xl mx-auto flex flex-col gap-8 h-full">
            
            {/* Active Segment Meta */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Current Segment</p>
                <h3 className="text-xl font-bold text-white truncate">{title}</h3>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-center items-end text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Duration</p>
                <p className="text-xl font-medium text-white tabular-nums">{formatDuration(duration)}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mt-1">{type}</p>
              </div>
            </div>

            {/* Teleprompter Screen */}
            <div className="flex-1 bg-black rounded-2xl border border-zinc-800/80 shadow-[inset_0_2px_20px_rgba(0,0,0,0.5)] p-8 overflow-y-auto relative custom-scrollbar min-h-[300px]">
              {renderScript()}
              
              {/* Subtle screen glare effect */}
              <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none rounded-t-2xl" />
            </div>

            {/* Next Up Peek */}
            {nextSegment && (
              <div className="flex items-center justify-between bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <FastForward className="w-4 h-4 text-zinc-500" />
                  <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Next Up</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-zinc-300">{nextSegment.title}</span>
                  <span className="text-xs font-mono text-zinc-500 bg-zinc-900 px-2 py-1 rounded">
                    {formatDuration(nextSegment.duration_seconds)}
                  </span>
                </div>
              </div>
            )}
            
          </div>
        )}
      </div>
    </div>
  );
}
