import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/session/[id]/running-order
 *
 * Returns latest running order + all segments for the session.
 * Uses service-role reads after verifying the session belongs to the user.
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
      console.error("[running-order] unauthorized", authError?.message);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const userId = authData.user.id;

    // Session ownership
    const { data: session, error: sessionError } = await admin
      .from("sessions")
      .select("id, user_id, status")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError) {
      console.error("[running-order] session error", sessionError.message);
      return NextResponse.json({ error: sessionError.message }, { status: 500 });
    }
    if (!session) {
      console.error("[running-order] session not found", sessionId);
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (session.user_id !== userId) {
      console.error("[running-order] forbidden", {
        sessionUser: session.user_id,
        authUser: userId,
      });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Prefer highest version; if multiple rows, take first after sort
    const { data: roRows, error: roError } = await admin
      .from("running_orders")
      .select("id, session_id, version, total_duration_seconds, created_at")
      .eq("session_id", sessionId)
      .order("version", { ascending: false })
      .limit(5);

    if (roError) {
      console.error("[running-order] RO error", roError.message);
      return NextResponse.json({ error: roError.message }, { status: 500 });
    }

    const ro = roRows?.[0] ?? null;
    if (!ro) {
      console.info("[running-order] no RO for", sessionId);
      return NextResponse.json({
        sessionId,
        runningOrderId: null,
        version: 0,
        totalDurationSeconds: 0,
        segments: [],
        activeSegment: null,
      });
    }

    // Direct segment query (more reliable than nested select)
    let { data: segments, error: segError } = await admin
      .from("segments")
      .select(
        "id, running_order_id, position, title, slug, segment_type, duration_seconds, start_offset_seconds, teleprompter_text, status, news_item_id",
      )
      .eq("running_order_id", ro.id)
      .order("position", { ascending: true });

    if (segError) {
      console.error("[running-order] segments error", segError.message);
      return NextResponse.json({ error: segError.message }, { status: 500 });
    }

    // Fallback: if latest RO has 0 segments, try older RO versions
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
          console.info(
            "[running-order] fallback RO",
            candidate.id,
            "v",
            candidate.version,
            "segs",
            altSegs.length,
          );
          segments = altSegs;
          break;
        }
      }
    }

    const list = (segments ?? []).map((s) => ({
      ...s,
      // Ensure teleprompter never looks "hardcoded empty" without reason
      teleprompter_text:
        s.teleprompter_text?.trim() ||
        `[${s.title}]\n\n(इस सेगमेंट के लिए टेलीप्रॉम्प्टर टेक्स्ट उपलब्ध नहीं है।)`,
    }));

    console.info("[running-order] ok", {
      sessionId: sessionId.slice(0, 8),
      roId: ro.id.slice(0, 8),
      version: ro.version,
      segments: list.length,
    });

    return NextResponse.json({
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
    });
  } catch (e) {
    console.error("[running-order] unexpected", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
