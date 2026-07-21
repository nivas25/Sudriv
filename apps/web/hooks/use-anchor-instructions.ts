"use client";

import { useEffect, useState } from "react";
import type { AnchorInstruction } from "@/types/timeline";

/**
 * Hook: useAnchorInstructions
 *
 * Subscribes to real-time anchor instruction updates via Supabase Realtime.
 *
 * See: knowledge-base/07-frontend-architecture.md (Anchor Instructions Subscription)
 */
export function useAnchorInstructions(sessionId: string) {
  const [instructions, setInstructions] = useState<AnchorInstruction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // TODO: Initial load + Supabase Realtime subscription
    // See knowledge-base/07-frontend-architecture.md for implementation
    setIsLoading(false);
  }, [sessionId]);

  return { instructions, isLoading };
}
