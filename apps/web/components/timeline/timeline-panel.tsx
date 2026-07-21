"use client";

import { useRunningOrder } from "@/hooks/use-running-order";
import { TimelineSegment } from "./timeline-segment";
import { TimelineHeader } from "./timeline-header";

/**
 * TimelinePanel — Main running order display with drag-and-drop
 *
 * Left panel in the 3-column session layout.
 * Shows all segments in order with visual status indicators.
 *
 * See: knowledge-base/07-frontend-architecture.md (Timeline Panel)
 *
 * TODO:
 * - Integrate @dnd-kit for drag-and-drop reordering
 * - Add ImpactOverlay when proposal is pending
 * - Connect to real-time running order data
 */
export function TimelinePanel({ sessionId }: { sessionId: string }) {
  const { segments, totalDuration, isLoading } = useRunningOrder(sessionId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest animate-pulse">Loading timeline...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden">
      <TimelineHeader
        segmentCount={segments.length}
        totalDuration={totalDuration}
      />
      <div className="flex-1 overflow-y-auto">
        {segments.length === 0 ? (
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest text-center py-8">
            No segments loaded.
          </p>
        ) : (
          segments.map((segment) => (
            <TimelineSegment key={segment.id} segment={segment} />
          ))
        )}
      </div>
    </div>
  );
}
