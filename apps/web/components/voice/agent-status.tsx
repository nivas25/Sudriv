"use client";

import type { AgentState } from "@/types/voice";
import { cn } from "@/lib/utils";

/**
 * AgentStatus — Connection status indicator
 */
export function AgentStatus({ state }: { state: AgentState }) {
  const config: Record<AgentState, { color: string; label: string }> = {
    disconnected: { color: "bg-muted-foreground", label: "Disconnected" },
    connecting: { color: "bg-warning animate-pulse", label: "Connecting..." },
    idle: { color: "bg-success", label: "Ready" },
    listening: { color: "bg-success animate-pulse", label: "Listening..." },
    thinking: { color: "bg-warning animate-pulse", label: "Processing..." },
    speaking: { color: "bg-primary animate-pulse", label: "Speaking..." },
  };

  const { color, label } = config[state];

  return (
    <div className="flex items-center gap-2">
      <div className={cn("w-2.5 h-2.5 rounded-full", color)} />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}
