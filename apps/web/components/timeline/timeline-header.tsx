"use client";

import { formatDuration } from "@/lib/utils";
import { ListVideo, RefreshCw } from "lucide-react";

export function TimelineHeader({
  segmentCount,
  totalDuration,
  version,
  onRefresh,
  isRefreshing = false,
}: {
  segmentCount: number;
  totalDuration: number;
  version?: number;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}) {
  return (
    <div className="flex flex-col px-5 py-5 border-b border-gray-100 bg-white/50 backdrop-blur-sm gap-5">
      
      {/* Top row: Title, Version, and Refresh */}
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-3">
          <ListVideo className="w-5 h-5 text-gray-400 shrink-0" />
          <h2 className="font-heading font-extrabold text-xl text-gray-900 tracking-tight">
            Timeline
          </h2>
          {typeof version === "number" && version > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-sm font-bold bg-gray-900 text-white tabular-nums shadow-sm">
              v{version}
            </span>
          )}
        </div>

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh timeline from server"
            className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100/80 text-gray-500 hover:bg-gray-200 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all shrink-0"
          >
            <RefreshCw
              className={`w-4 h-4 ${isRefreshing ? "animate-spin text-primary" : ""}`}
            />
          </button>
        )}
      </div>

      {/* Bottom row: Centered Stats Box */}
      <div className="flex items-center justify-evenly bg-gray-50/80 rounded-2xl py-4 px-2 border border-gray-100/80 shadow-[0_2px_10px_rgb(0,0,0,0.02)] w-full">
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Segments</span>
          <span className="font-heading font-extrabold text-2xl tabular-nums text-gray-900 leading-none">{segmentCount}</span>
        </div>
        
        <div className="w-px h-10 bg-gray-200/80" />
        
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Total Time</span>
          <span className="font-heading font-extrabold text-2xl tabular-nums text-primary leading-none">{formatDuration(totalDuration)}</span>
        </div>
      </div>
    </div>
  );
}
