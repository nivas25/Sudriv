"use client";

import { formatDuration } from "@/lib/utils";
import { ListVideo } from "lucide-react";

export function TimelineHeader({
  segmentCount,
  totalDuration,
}: {
  segmentCount: number;
  totalDuration: number;
}) {
  return (
    <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-white">
      <div className="flex items-center gap-3">
        <ListVideo className="w-5 h-5 text-gray-400" />
        <h2 className="font-heading font-bold text-lg text-gray-900 tracking-tight">Timeline</h2>
      </div>
      <div className="flex gap-4 text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-1">
        <span>{segmentCount} Segments</span>
        <span>{formatDuration(totalDuration)}</span>
      </div>
    </div>
  );
}
