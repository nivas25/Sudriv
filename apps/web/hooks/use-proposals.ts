"use client";

import { useEffect, useState } from "react";
import type { Proposal } from "@/types/timeline";

/**
 * Hook: useProposals
 *
 * Tracks pending proposals in real-time for the impact overlay.
 *
 * See: knowledge-base/07-frontend-architecture.md (Impact Overlay)
 */
export function useProposals(sessionId: string) {
  const [pendingProposal, setPendingProposal] = useState<Proposal | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // TODO: Subscribe to proposals table for real-time updates
    // Filter: session_id = sessionId, status = 'pending'
    setIsLoading(false);
  }, [sessionId]);

  return { pendingProposal, isLoading };
}
