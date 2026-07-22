"use client";

import { FileText, Clock, Info, Loader2 } from "lucide-react";
import { formatDuration } from "@/lib/utils";
import { useRunningOrder } from "@/hooks/use-running-order";

export function MetadataPanel({ sessionId }: { sessionId: string }) {
  const { activeSegment: segment, isLoading: loading, error } =
    useRunningOrder(sessionId);

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100 bg-white">
        <FileText className="w-5 h-5 text-gray-400" />
        <h2 className="font-heading font-bold text-lg text-gray-900 tracking-tight">
          Active Context
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : !segment ? (
          <p className="text-sm text-gray-400 font-medium">No active segment</p>
        ) : (
          <>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                Title
              </p>
              <p className="text-sm font-semibold text-gray-900">{segment.title}</p>
            </div>
            <div className="flex gap-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Duration
                </p>
                <p className="text-sm font-medium text-gray-900">
                  {formatDuration(segment.duration_seconds)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1 flex items-center gap-1">
                  <Info className="w-3 h-3" /> Type
                </p>
                <p className="text-sm font-medium text-gray-900 uppercase">
                  {segment.segment_type}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                  Slot
                </p>
                <p className="text-sm font-medium text-gray-900">{segment.position}</p>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                Status
              </p>
              <p className="text-sm font-medium text-gray-900 uppercase">
                {segment.status}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
