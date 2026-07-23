import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomUUID } from "crypto";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const admin = createAdminClient();
    
    // 1. Fetch user and template in parallel to halve initial wait time
    const [
      { data: authData, error: authError },
      { data: template, error: templateError }
    ] = await Promise.all([
      supabase.auth.getUser(),
      admin
        .from("timelines_library")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    ]);

    if (authError || !authData.user) {
      console.error("[session/POST] Auth error:", authError?.message);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (templateError || !template) {
      console.error("[session/POST] Template error:", templateError?.message);
      return NextResponse.json({ error: `No templates found` }, { status: 500 });
    }

    const userId = authData.user.id;
    const userEmail = authData.user.email;
    
    // 2. Fire-and-forget user sync to save ~500ms
    admin.from("users").upsert({
      id: userId,
      email: userEmail,
      display_name: userEmail?.split('@')[0] || "Producer"
    }).then(({ error }) => { if (error) console.error("User sync error:", error); });

    // 3. Pre-generate UUIDs locally to prevent multiple database roundtrips
    const sessionId = randomUUID();
    const runningOrderId = randomUUID();

    let offset = 0;
    const segmentsToInsert = [];
    if (template.default_segments && Array.isArray(template.default_segments)) {
      const sorted = [...template.default_segments].sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));
      for (const seg of sorted) {
        const duration = Number(seg.duration_seconds) || 0;
        segmentsToInsert.push({
          id: randomUUID(),
          running_order_id: runningOrderId,
          position: seg.position,
          title: seg.title,
          slug: seg.slug || `seg-${seg.position}`,
          segment_type: seg.segment_type || "package",
          duration_seconds: duration,
          start_offset_seconds: offset,
          teleprompter_text: (seg.teleprompter_text || seg.script || "").trim() || `${seg.title}\n\nयह ${seg.title} सेगमेंट है। एंकर यहाँ स्क्रिप्ट पढ़ेंगे।`,
          status: "pending",
        });
        offset += duration;
      }
    }

    // 4. Execute inserts sequentially without returning data (.select()) to maximize speed
    await admin.from("sessions").insert({
      id: sessionId,
      user_id: userId,
      timeline_template_id: template.id,
      status: "active",
      started_at: new Date().toISOString(),
      livekit_room_name: `room-${Date.now()}`
    });

    await admin.from("running_orders").insert({
      id: runningOrderId,
      session_id: sessionId,
      version: 1,
      total_duration_seconds: offset > 0 ? offset : template.default_duration_seconds
    });

    if (segmentsToInsert.length > 0) {
      await admin.from("segments").insert(segmentsToInsert);
    }

    console.log("[session/POST] ✅ Session creation complete:", sessionId);
    
    return NextResponse.json({ sessionId });
  } catch (err: any) {
    console.error("[session/POST] Unhandled error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
