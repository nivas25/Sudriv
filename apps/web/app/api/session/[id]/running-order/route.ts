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

type RoPayload = {
  sessionId: string;
  runningOrderId: string | null;
  version: number;
  totalDurationSeconds: number;
  segments: SegmentRow[];
  activeSegment: SegmentRow | null;
  source: string;
};

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      "CDN-Cache-Control": "no-store",
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

function asPayload(
  sessionId: string,
  version: number,
  total: number,
  segs: SegmentRow[],
  source: string,
  runningOrderId: string | null = null,
): RoPayload {
  return {
    sessionId,
    runningOrderId,
    version,
    totalDurationSeconds: total,
    segments: segs,
    activeSegment:
      segs.find((s) => s.status === "on_air") ??
      segs.find((s) => s.status === "pending") ??
      segs[0] ??
      null,
    source,
  };
}

async function readRedisRo(sessionId: string): Promise<RoPayload | null> {
  try {
    let cached = await redis.get<unknown>(`running_order:${sessionId}`);
    if (!cached) return null;
    // Upstash may return object or JSON string depending on write path
    if (typeof cached === "string") {
      try {
        cached = JSON.parse(cached);
      } catch {
        return null;
      }
    }
    if (!cached || typeof cached !== "object") return null;
    const obj = cached as Record<string, unknown>;
    const segs = normalizeSegments(
      Array.isArray(obj.segments) ? obj.segments : [],
    );
    const version = Number(obj.version) || 0;
    if (segs.length === 0 && version === 0) return null;
    const total =
      Number(obj.total_duration_seconds) ||
      segs.reduce((n, s) => n + (s.duration_seconds || 0), 0);
    return asPayload(sessionId, version, total, segs, "redis");
  } catch (e) {
    console.warn(
      "[running-order] redis:",
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/**
 * Prefer the *newer* of Redis (agent hot cache) vs Supabase.
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

    const redisRo = await readRedisRo(sessionId);

    // Supabase always (for version compare + fallback)
    const { data: roRows, error: roError } = await admin
      .from("running_orders")
      .select("id, session_id, version, total_duration_seconds, created_at")
      .eq("session_id", sessionId)
      .order("version", { ascending: false })
      .limit(5);

    if (roError) {
      if (redisRo) return noStoreJson(redisRo);
      return noStoreJson({ error: roError.message }, 500);
    }

    const ro = roRows?.[0] ?? null;
    let dbRo: RoPayload | null = null;

    if (ro) {
      let { data: segments, error: segError } = await admin
        .from("segments")
        .select(
          "id, running_order_id, position, title, slug, segment_type, duration_seconds, start_offset_seconds, teleprompter_text, status, news_item_id",
        )
        .eq("running_order_id", ro.id)
        .order("position", { ascending: true });

      if (segError) {
        if (redisRo) return noStoreJson(redisRo);
        return noStoreJson({ error: segError.message }, 500);
      }

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
      dbRo = asPayload(
        sessionId,
        ro.version ?? 0,
        ro.total_duration_seconds ?? 0,
        list,
        "supabase",
        ro.id,
      );
    }

    // Pick newer version; prefer Redis on tie (agent just wrote it)
    let chosen: RoPayload | null = null;
    if (redisRo && dbRo) {
      chosen =
        redisRo.version > dbRo.version
          ? redisRo
          : redisRo.version < dbRo.version
            ? dbRo
            : redisRo.segments.length >= dbRo.segments.length
              ? redisRo
              : dbRo;
    } else {
      chosen = redisRo ?? dbRo;
    }

    if (!chosen) {
      return noStoreJson(
        asPayload(sessionId, 0, 0, [], "empty"),
      );
    }

    console.info("[running-order] ok", {
      sessionId: sessionId.slice(0, 8),
      source: chosen.source,
      version: chosen.version,
      segments: chosen.segments.length,
      redisV: redisRo?.version ?? null,
      dbV: dbRo?.version ?? null,
    });

    return noStoreJson(chosen);
  } catch (e) {
    console.error("[running-order] unexpected", e);
    return noStoreJson({ error: "Internal server error" }, 500);
  }
}
