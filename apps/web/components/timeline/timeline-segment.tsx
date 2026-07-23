"use client";

import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/utils";
import { SEGMENT_TYPES, SEGMENT_STATUSES } from "@/lib/constants";
import type { Segment } from "@/types/timeline";

import { motion } from "framer-motion";

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
      case "live": return "bg-red-500 text-white border-transparent shadow-sm";
      case "package": return "bg-gray-900 text-white border-transparent shadow-sm";
      case "headlines": return "bg-blue-500 text-white border-transparent shadow-sm";
      case "break": return "bg-gray-500 text-white border-transparent shadow-sm";
      case "vtr": return "bg-purple-600 text-white border-transparent shadow-sm";
      case "gfx": return "bg-teal-500 text-white border-transparent shadow-sm";
      default: return "bg-gray-100 text-gray-600 border-gray-200";
    }
  };

  return (
    <motion.div
      layout
      initial={{ x: -30, opacity: 0, scale: 0.95 }}
      animate={{ x: 0, opacity: 1, scale: 1 }}
      exit={{ x: 30, opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={cn(
        "flex flex-col px-5 py-4 bg-white border-b border-gray-100 last:border-0 hover:bg-gray-50/80 transition-colors group cursor-pointer",
        segment.status === "on_air" && "border-l-4 border-l-red-500 bg-red-50/10",
        segment.status === "completed" && "opacity-50 grayscale",
        segment.status === "skipped" && "opacity-30 line-through",
        isAffected && "animate-pulse bg-yellow-50/30 border-l-4 border-l-yellow-400"
      )}
    >
      <div className="flex items-start gap-4">
        {/* Sequence Number */}
        <div className="flex flex-col items-center justify-center mt-1 w-6 shrink-0">
          <span className="font-heading font-extrabold text-gray-300 tabular-nums text-sm group-hover:text-gray-900 transition-colors">
            {String(segment.position).padStart(2, '0')}
          </span>
        </div>
        
        {/* Content Area */}
        <div className="flex flex-col flex-1 min-w-0 gap-2">
          {/* Top Row: Badge & Duration */}
          <div className="flex justify-between items-center">
            <span className={cn(
              "text-[10px] font-extrabold px-2 py-1 rounded uppercase tracking-widest leading-none",
              getBadgeStyle(segment.segment_type)
            )}>
              {segment.segment_type}
            </span>
            <div className="flex items-center gap-2">
              {segment.status === "on_air" && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500 rounded text-white shadow-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>
                  <span className="text-[9px] font-bold uppercase tracking-widest leading-none">ON AIR</span>
                </div>
              )}
              <span className="font-heading font-bold text-gray-500 tabular-nums text-[11px] bg-gray-100/80 px-2.5 py-1 rounded-md border border-gray-200/60 shadow-sm">
                {formatDuration(segment.duration_seconds)}
              </span>
            </div>
          </div>

          {/* Bottom Row: Title */}
          <span className={cn(
            "font-bold text-base leading-tight mt-0.5",
            segment.status === "on_air" ? "text-red-600" : "text-gray-900 group-hover:text-primary transition-colors"
          )}>
            {segment.title}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
