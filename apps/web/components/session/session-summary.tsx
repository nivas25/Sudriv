"use client";

import type { SessionSummary } from "@/types/session";

/**
 * SessionSummary — Post-session statistics
 * See: knowledge-base/02-user-flows-mvp.md (Flow 5: Session End)
 */
export function SessionSummaryView({ summary }: { summary: SessionSummary }) {
  // TODO: Display session statistics
  // - Total duration
  // - Running order changes
  // - Proposals created / confirmed / rejected
  // - Anchor instructions sent

  return (
    <div className="panel p-6 max-w-lg mx-auto space-y-4">
      <h2 className="text-xl font-bold">Session Complete</h2>
      <p className="text-muted-foreground text-sm">
        Session summary will appear here after implementation.
      </p>
      {/* TODO: Render summary data */}
    </div>
  );
}
