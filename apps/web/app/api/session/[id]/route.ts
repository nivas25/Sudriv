import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redis } from "@/lib/redis/client";
import { RoomServiceClient } from "livekit-server-sdk";
import { roomNameForSession } from "@/lib/livekit/config";

/**
 * GET    /api/session/[id] — Get session details
 * POST   /api/session/[id] — Perform session action (end, pause)
 * DELETE /api/session/[id] — Force-end a session
 *
 * See: knowledge-base/08-backend-and-realtime.md (End Session)
 */

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;

  // TODO: Implement session detail fetching
  // 1. Authenticate user
  // 2. Fetch session by ID
  // 3. Include running order summary + segment count
  // 4. Return session data

  return NextResponse.json(
    { error: "Not implemented", sessionId },
    { status: 501 }
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;

  try {
    const { action } = await request.json();

    if (action === "end") {
      const admin = createAdminClient();

      // 1. Update session status to "ended"
      await admin
        .from("sessions")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("id", sessionId);

      // 2. Delete LiveKit room to kill agent workers
      const roomName = roomNameForSession(sessionId);
      const roomService = new RoomServiceClient(
        process.env.NEXT_PUBLIC_LIVEKIT_URL || process.env.LIVEKIT_URL!,
        process.env.LIVEKIT_API_KEY!,
        process.env.LIVEKIT_API_SECRET!
      );
      
      try {
        await roomService.deleteRoom(roomName);
        console.log(`[session/end] Deleted LiveKit room: ${roomName}`);
      } catch (err: any) {
        // Room might already be deleted or empty, that's fine
        console.log(`[session/end] Room delete skipped/failed: ${err.message}`);
      }

      // 3. Clear Redis cache
      await redis.del(
        `running_order:${sessionId}`,
        `proposal:${sessionId}`,
        `chat_context:${sessionId}`,
        `session:${sessionId}:lock`
      );
      console.log(`[session/end] Cleared Redis cache for session: ${sessionId}`);

      // 4. Log session_ended event
      await admin.from("session_events").insert({
        session_id: sessionId,
        event_type: "session_ended",
        payload: { ended_at: new Date().toISOString(), reason: "user_action" },
        source: "system",
      });

      return NextResponse.json({ status: "ended", sessionId });
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (error) {
    console.error(`Failed to perform session action on ${sessionId}:`, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
