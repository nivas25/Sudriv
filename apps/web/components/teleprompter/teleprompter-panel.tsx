"use client";

import { FileText, MonitorPlay, Loader2, RefreshCw } from "lucide-react";
import { useRunningOrder } from "@/hooks/use-running-order";

/**
 * Anchor Script — teleprompter text for the active / next segment.
 * Same data source as Timeline (API + poll + manual refresh).
 */
export function TeleprompterPanel({ sessionId }: { sessionId: string }) {
  const {
    activeSegment,
    isLoading,
    isRefreshing,
    error,
    segments,
    version,
    reload,
  } = useRunningOrder(sessionId);

  const title = activeSegment
    ? `Segment ${String(activeSegment.position).padStart(2, "0")}: ${activeSegment.title}`
    : segments.length === 0
      ? "No segments"
      : "No active segment";

  const rawScript = activeSegment?.teleprompter_text?.trim() ?? "";
  const script =
    rawScript ||
    (isLoading
      ? ""
      : activeSegment
        ? `(No teleprompter text for “${activeSegment.title}” yet.)`
        : "Waiting for running order…");

  const renderScript = () => {
    const parts = script.split(/(\[[^\]]+\])/);
    return parts.map((part, index) => {
      if (part.startsWith("[") && part.endsWith("]")) {
        return (
          <div
            key={index}
            className="flex items-center gap-3 py-3 px-4 bg-gray-50 border-l-2 border-primary rounded-r-md my-4"
          >
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            <span className="text-xs font-bold tracking-widest uppercase text-gray-900">
              {part}
            </span>
          </div>
        );
      }
      if (!part) return null;
      return (
        <p
          key={index}
          className="text-base leading-relaxed text-gray-800 font-medium tracking-wide whitespace-pre-wrap"
        >
          {part}
        </p>
      );
    });
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden relative">
      <div className="flex items-center justify-between px-5 py-5 border-b border-gray-100 bg-white z-10 gap-2">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <MonitorPlay className="w-5 h-5 text-gray-400 shrink-0" />
          <h2 className="font-heading font-extrabold text-xl text-gray-900 tracking-tight flex items-center gap-3">
            Anchor Script
            {version > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-sm font-bold bg-gray-900 text-white tabular-nums shadow-sm">
                v{version}
              </span>
            )}
          </h2>
        </div>
        
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-sm border border-red-200 bg-red-50">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] font-bold text-red-700 uppercase tracking-widest">
              Live Feed
            </span>
          </div>
          
          <button
            type="button"
            onClick={reload}
            disabled={isRefreshing}
            title="Refresh anchor script"
            className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100/80 text-gray-500 hover:bg-gray-200 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all shrink-0"
          >
            <RefreshCw
              className={`w-4 h-4 ${isRefreshing ? "animate-spin text-primary" : ""}`}
            />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#fafcfd]">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
          </div>
        ) : error ? (
          <div className="text-center py-8 space-y-3">
            <p className="text-sm text-red-600 font-medium">{error}</p>
            <button
              type="button"
              onClick={reload}
              className="text-xs font-bold uppercase tracking-widest text-primary underline"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 bg-white border border-gray-200 shadow-sm rounded-md flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-gray-600">
                  {title}
                </span>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
              {renderScript()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
