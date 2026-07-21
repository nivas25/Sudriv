"use client";

import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/utils";
import { SEGMENT_TYPES, SEGMENT_STATUSES } from "@/lib/constants";
import type { Segment } from "@/types/timeline";

/**
 * TimelineSegment — Individual segment card in the timeline
 *
 * Visual states: pending, on_air, completed, skipped, affected_by_proposal
 *
 * See: knowledge-base/07-frontend-architecture.md (Segment Visual States)
 */
export function TimelineSegment({
  segment,
  isAffected = false,
}: {
  segment: Segment;
  isAffected?: boolean;
}) {
  const getBadgeStyle = (type: string) => {
    switch (type.toLowerCase()) {
      case "live": return "bg-primary text-white border-primary";
      case "package": return "bg-gray-900 text-white border-gray-900";
      case "headlines": return "bg-white text-gray-900 border-gray-900";
      default: return "bg-white text-gray-500 border-gray-200";
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col px-4 py-3 bg-white border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors group cursor-pointer",
        segment.status === "on_air" && "border-l-4 border-l-primary bg-red-50/20",
        segment.status === "completed" && "opacity-50 grayscale",
        segment.status === "skipped" && "opacity-30 line-through",
        isAffected && "animate-pulse bg-yellow-50/30 border-l-4 border-l-yellow-400"
      )}
    >
      <div className="flex items-center gap-3">
        <span className="font-heading font-bold text-gray-400 tabular-nums text-sm group-hover:text-gray-900 transition-colors w-5 shrink-0">
          {segment.position}
        </span>
        
        <div className="flex flex-col flex-1 min-w-0">
          <span className={cn(
            "font-semibold text-sm leading-tight truncate",
            segment.status === "on_air" ? "text-primary" : "text-gray-900"
          )}>
            {segment.title}
          </span>
          <div className="flex items-center gap-3 mt-1.5">
            <span className={cn(
              "text-[9px] font-bold px-1.5 py-0.5 rounded-sm border-[1.5px] uppercase tracking-widest leading-none",
              getBadgeStyle(segment.segment_type)
            )}>
              {segment.segment_type}
            </span>
            <span className="font-heading font-medium text-gray-500 tabular-nums text-xs">
              {formatDuration(segment.duration_seconds)}
            </span>
          </div>
        </div>

        {segment.status === "on_air" && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-red-500 rounded-sm shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>
            <span className="text-[10px] font-bold text-white uppercase tracking-widest leading-none">ON AIR</span>
          </div>
        )}
      </div>
    </div>
  );
}
