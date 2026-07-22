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
    <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100 bg-white gap-2">
      <div className="flex items-center gap-3 min-w-0">
        <ListVideo className="w-5 h-5 text-gray-400 shrink-0" />
        <div className="min-w-0">
          <h2 className="font-heading font-bold text-lg text-gray-900 tracking-tight">
            Timeline
          </h2>
          <div className="flex gap-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-0.5">
            <span>{segmentCount} Segments</span>
            <span>{formatDuration(totalDuration)}</span>
            {typeof version === "number" && version > 0 && (
              <span className="text-gray-300">v{version}</span>
            )}
          </div>
        </div>
      </div>

      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Refresh timeline from server"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-[10px] font-bold uppercase tracking-widest hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
          />
          {isRefreshing ? "Refreshing…" : "Refresh"}
        </button>
      )}
    </div>
  );
}
