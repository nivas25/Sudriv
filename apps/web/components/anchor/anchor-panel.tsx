"use client";

import { useAnchorInstructions } from "@/hooks/use-anchor-instructions";
import { InstructionCard } from "./instruction-card";

/**
 * AnchorPanel — Anchor instruction display
 *
 * Right panel in the 3-column session layout.
 * Shows generated instructions for the anchor in reverse chronological order.
 *
 * See: knowledge-base/07-frontend-architecture.md (Anchor Panel)
 */
export function AnchorPanel({ sessionId }: { sessionId: string }) {
  const { instructions, isLoading } = useAnchorInstructions(sessionId);

  return (
    <>
      <div className="panel-header">Anchor Instructions</div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Loading...
          </p>
        ) : instructions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No instructions yet. Instructions will appear here after timeline
            changes are confirmed.
          </p>
        ) : (
          instructions.map((instruction) => (
            <InstructionCard
              key={instruction.id}
              instruction={instruction}
            />
          ))
        )}
      </div>
    </>
  );
}
