"use client";

import { useEffect, useState } from "react";
import type { Session } from "@/types/session";

/**
 * Hook: useSession
 *
 * Manages the current session state and subscribes to status changes.
 */
export function useSession(sessionId: string) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch session details from API
    // TODO: Subscribe to session status changes via Supabase Realtime
    setIsLoading(false);
  }, [sessionId]);

  const endSession = async () => {
    // TODO: POST /api/session/[id] with action: "end"
  };

  return { session, isLoading, endSession };
}
