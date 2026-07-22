"use client";

import { useRunningOrder } from "@/hooks/use-running-order";
import { TimelineSegment } from "./timeline-segment";
import { TimelineHeader } from "./timeline-header";

/**
 * TimelinePanel — running order list with manual Refresh + auto-poll.
 */
export function TimelinePanel({ sessionId }: { sessionId: string }) {
  const {
    segments,
    totalDuration,
    isLoading,
    isRefreshing,
    error,
    version,
    reload,
  } = useRunningOrder(sessionId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest animate-pulse">
          Loading timeline...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden">
      <TimelineHeader
        segmentCount={segments.length}
        totalDuration={totalDuration}
        version={version}
        onRefresh={reload}
        isRefreshing={isRefreshing}
      />
      <div className="flex-1 overflow-y-auto">
        {error ? (
          <div className="text-center py-8 px-4 space-y-3">
            <p className="text-sm font-medium text-red-600">
              Failed to load timeline: {error}
            </p>
            <button
              type="button"
              onClick={reload}
              className="text-xs font-bold uppercase tracking-widest text-primary underline"
            >
              Retry
            </button>
          </div>
        ) : segments.length === 0 ? (
          <div className="text-center py-8 px-4 space-y-3">
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">
              No segments loaded.
            </p>
            <p className="text-[10px] font-medium text-gray-400">
              Session {sessionId.slice(0, 8)}… · v{version}
            </p>
            <button
              type="button"
              onClick={reload}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-gray-800 disabled:opacity-50"
            >
              {isRefreshing ? "Refreshing…" : "Refresh now"}
            </button>
          </div>
        ) : (
          segments.map((segment) => (
            <TimelineSegment
              // Include version + position so React remounts after agent apply
              // (segment UUIDs can change when agent rewrites the RO).
              key={`v${version}-${segment.position}-${segment.id}`}
              segment={segment as any}
            />
          ))
        )}
      </div>
    </div>
  );
}
