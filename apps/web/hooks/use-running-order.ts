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
  error?: string;
};

const POLL_MS = 1500;

/**
 * Live running order — API fetch + fast poll + manual refresh.
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

  const load = useCallback(
    async (reason: string) => {
      if (!sessionId || sessionId === "demo") {
        setIsLoading(false);
        return;
      }

      // Avoid stacking poll requests; manual refresh always runs.
      if (inFlightRef.current && reason !== "manual") return;
      inFlightRef.current = true;

      const isManual = reason === "manual";
      if (isManual) setIsRefreshing(true);

      try {
        // Cache-bust so browsers / proxies never serve stale RO
        const url = `/api/session/${sessionId}/running-order?t=${Date.now()}&r=${encodeURIComponent(reason)}`;
        const res = await fetch(url, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
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
          setError(msg);
          return;
        }

        const data: RunningOrderPayload = await res.json();
        const segs = Array.isArray(data.segments) ? data.segments : [];
        const fingerprint = `${data.version}:${segs.length}:${segs
          .map((s) => `${s.id}:${s.position}:${s.title}`)
          .join("|")}`;

        const changed = fingerprint !== lastFingerprintRef.current;
        if (changed || isManual) {
          console.info("[useRunningOrder] update", {
            reason,
            version: data.version,
            segments: segs.length,
            active: data.activeSegment?.title ?? null,
            sessionId: sessionId.slice(0, 8),
            changed,
          });
          lastFingerprintRef.current = fingerprint;
        }

        // Always apply state so manual refresh re-renders even if data identical
        setSegments(segs);
        setTotalDuration(data.totalDurationSeconds ?? 0);
        setVersion(data.version ?? 0);
        setActiveSegment(data.activeSegment ?? null);
        setError(null);
        setLastFetchedAt(Date.now());
      } catch (e) {
        console.error("[useRunningOrder] network error", reason, e);
        setError(
          e instanceof Error ? e.message : "Failed to load running order",
        );
      } finally {
        inFlightRef.current = false;
        setIsLoading(false);
        if (isManual) setIsRefreshing(false);
      }
    },
    [sessionId],
  );

  const reload = useCallback(() => {
    void load("manual");
  }, [load]);

  useEffect(() => {
    void load("mount");

    const id = window.setInterval(() => {
      void load("poll");
    }, POLL_MS);

    const onVis = () => {
      if (document.visibilityState === "visible") void load("focus");
    };
    document.addEventListener("visibilitychange", onVis);

    // Custom event so other UI can force a timeline refresh after apply
    const onForce = () => void load("event");
    window.addEventListener("sudriv:running-order-refresh", onForce);

    return () => {
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
