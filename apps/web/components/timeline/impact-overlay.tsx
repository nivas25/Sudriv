"use client";

import type { Proposal } from "@/types/timeline";

/**
 * ImpactOverlay — Visual diff overlay showing proposed changes
 *
 * Appears over the timeline when a proposal is pending.
 * Shows before/after comparison and affected segments.
 *
 * See: knowledge-base/07-frontend-architecture.md (Impact Overlay)
 *
 * TODO: Implement with Framer Motion animations
 */
export function ImpactOverlay({ proposal }: { proposal: Proposal }) {
  return (
    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
      <div className="panel p-6 m-4 max-w-md border-warning">
        <h3 className="font-semibold">Proposed Change</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {proposal.impact_analysis.summary}
        </p>
        {/* TODO: Render affected segments list with timing diffs */}
      </div>
    </div>
  );
}
