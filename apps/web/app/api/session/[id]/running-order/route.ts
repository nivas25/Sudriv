import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redis } from "@/lib/redis/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SegmentRow = {
  id: string;
  running_order_id?: string;
  position: number;
  title: string;
  slug?: string;
  segment_type: string;
  duration_seconds: number;
  start_offset_seconds?: number;
  teleprompter_text?: string | null;
  status: string;
  news_item_id?: string | null;
};

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
    },
  });
}

function normalizeSegments(raw: unknown[]): SegmentRow[] {
  return (raw as SegmentRow[])
    .filter((s) => s && typeof s.position === "number" && s.title)
    .map((s) => ({
      ...s,
      id: String(s.id ?? `pos-${s.position}`),
      segment_type: s.segment_type || "package",
      duration_seconds: Number(s.duration_seconds) || 0,
      start_offset_seconds: Number(s.start_offset_seconds) || 0,
      status: s.status || "pending",
      teleprompter_text:
        (s.teleprompter_text || "").trim() ||
        `[${s.title}]\n\n(इस सेगमेंट के लिए टेलीप्रॉम्प्टर टेक्स्ट उपलब्ध नहीं है।)`,
    }))
    .sort((a, b) => a.position - b.position);
}

/**
 * GET /api/session/[id]/running-order
 *
 * Prefer agent Redis cache (written immediately on apply), then Supabase.
 * This is why the timeline lagged: agent updated Redis first, UI only read DB.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sessionId } = await params;

  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return noStoreJson({ error: "Unauthorized" }, 401);
    }

    const admin = createAdminClient();
    const userId = authData.user.id;

    const { data: session, error: sessionError } = await admin
      .from("sessions")
      .select("id, user_id, status")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError) {
      return noStoreJson({ error: sessionError.message }, 500);
    }
    if (!session) {
      return noStoreJson({ error: "Session not found" }, 404);
    }
    if (session.user_id !== userId) {
      return noStoreJson({ error: "Forbidden" }, 403);
    }

    // ── 1) Agent hot path: Redis ──────────────────────────────────────────
    // Key written by apps/agent SessionManager.update_running_order
    try {
      const cached = await redis.get<Record<string, unknown>>(
        `running_order:${sessionId}`,
      );
      if (cached && typeof cached === "object") {
        const segs = normalizeSegments(
          Array.isArray(cached.segments) ? cached.segments : [],
        );
        const version = Number(cached.version) || 0;
        if (segs.length > 0 || version > 0) {
          const total =
            Number(cached.total_duration_seconds) ||
            segs.reduce((n, s) => n + (s.duration_seconds || 0), 0);

          console.info("[running-order] redis hit", {
            sessionId: sessionId.slice(0, 8),
            version,
            segments: segs.length,
          });

          return noStoreJson({
            sessionId,
            runningOrderId: null,
            version,
            totalDurationSeconds: total,
            segments: segs,
            activeSegment:
              segs.find((s) => s.status === "on_air") ??
              segs.find((s) => s.status === "pending") ??
              segs[0] ??
              null,
            source: "redis",
          });
        }
      }
    } catch (redisErr) {
      console.warn(
        "[running-order] redis read skipped:",
        redisErr instanceof Error ? redisErr.message : redisErr,
      );
    }

    // ── 2) Supabase source of truth ───────────────────────────────────────
    const { data: roRows, error: roError } = await admin
      .from("running_orders")
      .select("id, session_id, version, total_duration_seconds, created_at")
      .eq("session_id", sessionId)
      .order("version", { ascending: false })
      .limit(5);

    if (roError) {
      return noStoreJson({ error: roError.message }, 500);
    }

    const ro = roRows?.[0] ?? null;
    if (!ro) {
      return noStoreJson({
        sessionId,
        runningOrderId: null,
        version: 0,
        totalDurationSeconds: 0,
        segments: [],
        activeSegment: null,
        source: "supabase",
      });
    }

    let { data: segments, error: segError } = await admin
      .from("segments")
      .select(
        "id, running_order_id, position, title, slug, segment_type, duration_seconds, start_offset_seconds, teleprompter_text, status, news_item_id",
      )
      .eq("running_order_id", ro.id)
      .order("position", { ascending: true });

    if (segError) {
      return noStoreJson({ error: segError.message }, 500);
    }

    // If latest RO is empty mid-rewrite, fall back to a previous version
    if ((!segments || segments.length === 0) && roRows && roRows.length > 1) {
      for (const candidate of roRows.slice(1)) {
        const { data: altSegs } = await admin
          .from("segments")
          .select(
            "id, running_order_id, position, title, slug, segment_type, duration_seconds, start_offset_seconds, teleprompter_text, status, news_item_id",
          )
          .eq("running_order_id", candidate.id)
          .order("position", { ascending: true });
        if (altSegs && altSegs.length > 0) {
          segments = altSegs;
          break;
        }
      }
    }

    const list = normalizeSegments(segments ?? []);

    console.info("[running-order] supabase", {
      sessionId: sessionId.slice(0, 8),
      roId: ro.id.slice(0, 8),
      version: ro.version,
      segments: list.length,
    });

    return noStoreJson({
      sessionId,
      runningOrderId: ro.id,
      version: ro.version,
      totalDurationSeconds: ro.total_duration_seconds ?? 0,
      segments: list,
      activeSegment:
        list.find((s) => s.status === "on_air") ??
        list.find((s) => s.status === "pending") ??
        list[0] ??
        null,
      source: "supabase",
    });
  } catch (e) {
    console.error("[running-order] unexpected", e);
    return noStoreJson({ error: "Internal server error" }, 500);
  }
}
