import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // 1. Authenticate user (uses anon key + cookies for auth)
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      console.error("[session/POST] Auth error:", authError?.message);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = authData.user.id;
    const userEmail = authData.user.email;
    console.log("[session/POST] Authenticated user:", userId, userEmail);

    // Use admin client for all DB writes (bypasses RLS completely)
    const admin = createAdminClient();

    // 2. Ensure user exists in public.users (handles seed data id mismatch)
    const { data: existingUser } = await admin
      .from("users")
      .select("id")
      .eq("email", userEmail!)
      .maybeSingle();

    if (existingUser && existingUser.id !== userId) {
      // Seed data row has wrong UUID — delete and re-create with auth UUID
      console.log("[session/POST] Replacing stale user row (seed data id mismatch)");
      await admin.from("users").delete().eq("id", existingUser.id);
    }

    if (!existingUser || existingUser.id !== userId) {
      const { error: insertError } = await admin.from("users").insert({
        id: userId,
        email: userEmail,
        display_name: userEmail?.split('@')[0] || "Producer"
      });
      if (insertError) {
        console.error("[session/POST] User insert error:", insertError.message, insertError.details);
        return NextResponse.json({ error: `User sync failed: ${insertError.message}` }, { status: 500 });
      }
    }
    console.log("[session/POST] User ready");

    // 3. Load first template
    const { data: template, error: templateError } = await admin
      .from("timelines_library")
      .select("*")
      .limit(1)
      .single();

    if (templateError || !template) {
      console.error("[session/POST] Template error:", templateError?.message, templateError?.details, templateError?.hint);
      return NextResponse.json({ error: `No templates found: ${templateError?.message}` }, { status: 500 });
    }
    console.log("[session/POST] Template loaded:", template.id, template.name);

    // 4. Create session record
    const { data: session, error: sessionError } = await admin
      .from("sessions")
      .insert({
        user_id: userId,
        timeline_template_id: template.id,
        status: "active",
        started_at: new Date().toISOString(),
        livekit_room_name: `room-${Date.now()}`
      })
      .select()
      .single();

    if (sessionError || !session) {
      console.error("[session/POST] Session insert error:", sessionError?.message, sessionError?.details, sessionError?.hint, sessionError?.code);
      return NextResponse.json({ error: `Failed to create session: ${sessionError?.message}` }, { status: 500 });
    }
    console.log("[session/POST] Session created:", session.id);

    // 5. Create initial running order
    const { data: runningOrder, error: roError } = await admin
      .from("running_orders")
      .insert({
        session_id: session.id,
        version: 1,
        total_duration_seconds: template.default_duration_seconds
      })
      .select()
      .single();

    if (roError || !runningOrder) {
      console.error("[session/POST] Running order error:", roError?.message, roError?.details, roError?.hint);
      return NextResponse.json({ error: `Failed to create running order: ${roError?.message}` }, { status: 500 });
    }
    console.log("[session/POST] Running order created:", runningOrder.id);

    // 6. Create segments from template (with start offsets + teleprompter text)
    if (template.default_segments && Array.isArray(template.default_segments)) {
      const sorted = [...template.default_segments].sort(
        (a: any, b: any) => (a.position ?? 0) - (b.position ?? 0),
      );
      let offset = 0;
      const segmentsToInsert = sorted.map((seg: any) => {
        const duration = Number(seg.duration_seconds) || 0;
        const row = {
          running_order_id: runningOrder.id,
          position: seg.position,
          title: seg.title,
          slug: seg.slug || `seg-${seg.position}`,
          segment_type: seg.segment_type || "package",
          duration_seconds: duration,
          start_offset_seconds: offset,
          teleprompter_text:
            (seg.teleprompter_text || seg.script || "").trim() ||
            `${seg.title}\n\nयह ${seg.title} सेगमेंट है। एंकर यहाँ स्क्रिप्ट पढ़ेंगे।`,
          status: "pending",
        };
        offset += duration;
        return row;
      });

      // Update total duration from computed offsets
      if (segmentsToInsert.length > 0) {
        await admin
          .from("running_orders")
          .update({ total_duration_seconds: offset })
          .eq("id", runningOrder.id);
      }

      const { data: insertedSegs, error: segError } = await admin
        .from("segments")
        .insert(segmentsToInsert)
        .select("id, position, title");

      if (segError) {
        console.error(
          "[session/POST] Segments insert error:",
          segError.message,
          segError.details,
          segError.hint,
          segError.code,
        );
      } else {
        console.info("[session/POST] Segments created:", {
          count: insertedSegs?.length ?? segmentsToInsert.length,
          ro: runningOrder.id,
          titles: (insertedSegs ?? []).map((s) => s.title),
        });
      }
    } else {
      console.warn(
        "[session/POST] template.default_segments missing or empty",
        typeof template.default_segments,
      );
    }

    console.log("[session/POST] ✅ Session creation complete:", session.id);
    return NextResponse.json({ sessionId: session.id });
  } catch (error) {
    console.error("[session/POST] Unexpected exception:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const admin = createAdminClient();
    const { data: sessions, error } = await admin
      .from("sessions")
      .select("id, status, created_at, timelines_library(name)")
      .eq("user_id", authData.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ sessions });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
