import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // 1. Authenticate user
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = authData.user.id;

    // Load first template (ignoring passed ID for MVP simplicity)
    const { data: template, error: templateError } = await supabase
      .from("timelines_library")
      .select("*")
      .limit(1)
      .single();

    if (templateError || !template) {
      return NextResponse.json({ error: "No templates found" }, { status: 500 });
    }

    // Create session record
    const { data: session, error: sessionError } = await supabase
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
      return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
    }

    // Create initial running order
    const { data: runningOrder, error: roError } = await supabase
      .from("running_orders")
      .insert({
        session_id: session.id,
        version: 1,
        total_duration_seconds: template.default_duration_seconds
      })
      .select()
      .single();

    if (roError || !runningOrder) {
      return NextResponse.json({ error: "Failed to create running order" }, { status: 500 });
    }

    // Create segments from template
    if (template.default_segments && Array.isArray(template.default_segments)) {
      const segmentsToInsert = template.default_segments.map((seg: any) => ({
        running_order_id: runningOrder.id,
        position: seg.position,
        title: seg.title,
        slug: seg.slug || `seg-${seg.position}`,
        segment_type: seg.segment_type,
        duration_seconds: seg.duration_seconds,
        teleprompter_text: seg.teleprompter_text || "",
        status: "pending"
      }));

      await supabase.from("segments").insert(segmentsToInsert);
    }

    return NextResponse.json({ sessionId: session.id });
  } catch (error) {
    console.error("Failed to create session:", error);
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
    
    const { data: sessions, error } = await supabase
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
