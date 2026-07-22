"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RunningOrderSegment = {
  id: string;
  running_order_id?: string;
  position: number;
  title: string;
  slug?: string;
  segment_type: string;
  duration_seconds: number;
  start_offset_seconds?: number;
  teleprompter_text?: string;
  status: string;
  news_item_id?: string | null;
};

type RunningOrderPayload = {
  sessionId: string;
  runningOrderId: string | null;
  version: number;
  totalDurationSeconds: number;
  segments: RunningOrderSegment[];
  activeSegment: RunningOrderSegment | null;
  source?: string;
  error?: string;
};

const POLL_MS = 1200;

/**
 * Live running order — Redis-backed API + poll + manual refresh.
 *
 * Realtime was removed: Timeline / Teleprompter / Metadata each call this
 * hook, and Supabase reuses channel names → second mount hits
 * "cannot add postgres_changes callbacks after subscribe()".
 * Agent writes Redis first; the API prefers Redis, so poll is enough.
 */
export function useRunningOrder(sessionId: string) {
  const [segments, setSegments] = useState<RunningOrderSegment[]>([]);
  const [totalDuration, setTotalDuration] = useState(0);
  const [version, setVersion] = useState(0);
  const [activeSegment, setActiveSegment] = useState<RunningOrderSegment | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
  const lastFingerprintRef = useRef<string>("");
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);

  const load = useCallback(
    async (reason: string) => {
      if (!sessionId || sessionId === "demo") {
        setIsLoading(false);
        return;
      }

      // Manual always runs; poll skips if a request is already in flight
      if (inFlightRef.current && reason === "poll") return;
      inFlightRef.current = true;

      const isManual = reason === "manual";
      if (isManual) setIsRefreshing(true);

      try {
        const url = `/api/session/${sessionId}/running-order?t=${Date.now()}&r=${encodeURIComponent(reason)}`;
        const res = await fetch(url, {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const msg =
            (body as { error?: string }).error || `HTTP ${res.status}`;
          console.error("[useRunningOrder] fetch failed", {
            reason,
            msg,
            sessionId,
          });
          if (mountedRef.current) setError(msg);
          return;
        }

        const data: RunningOrderPayload = await res.json();
        if (!mountedRef.current) return;

        const segs = Array.isArray(data.segments) ? data.segments : [];
        const fingerprint = `${data.version}:${segs.length}:${segs
          .map(
            (s) =>
              `${s.id}:${s.position}:${s.title}:${s.duration_seconds}:${s.start_offset_seconds ?? 0}:${s.status}`,
          )
          .join("|")}`;

        const changed = fingerprint !== lastFingerprintRef.current;
        if (changed || isManual) {
          console.info("[useRunningOrder] update", {
            reason,
            source: data.source ?? "?",
            version: data.version,
            segments: segs.length,
            active: data.activeSegment?.title ?? null,
            sessionId: sessionId.slice(0, 8),
            changed,
          });
          lastFingerprintRef.current = fingerprint;
        }

        setSegments(segs);
        setTotalDuration(data.totalDurationSeconds ?? 0);
        setVersion(data.version ?? 0);
        setActiveSegment(data.activeSegment ?? null);
        setError(null);
        setLastFetchedAt(Date.now());
      } catch (e) {
        console.error("[useRunningOrder] network error", reason, e);
        if (mountedRef.current) {
          setError(
            e instanceof Error ? e.message : "Failed to load running order",
          );
        }
      } finally {
        inFlightRef.current = false;
        if (mountedRef.current) {
          setIsLoading(false);
          if (isManual) setIsRefreshing(false);
        }
      }
    },
    [sessionId],
  );

  const reload = useCallback(() => {
    void load("manual");
  }, [load]);

  useEffect(() => {
    mountedRef.current = true;
    void load("mount");

    const id = window.setInterval(() => {
      void load("poll");
    }, POLL_MS);

    const onVis = () => {
      if (document.visibilityState === "visible") void load("focus");
    };
    document.addEventListener("visibilitychange", onVis);

    const onForce = () => void load("event");
    window.addEventListener("sudriv:running-order-refresh", onForce);

    return () => {
      mountedRef.current = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("sudriv:running-order-refresh", onForce);
    };
  }, [load]);

  return {
    segments,
    totalDuration,
    version,
    activeSegment,
    isLoading,
    isRefreshing,
    error,
    lastFetchedAt,
    reload,
  };
}
