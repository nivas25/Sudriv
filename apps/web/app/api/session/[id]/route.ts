import { NextResponse } from "next/server";
// import { createClient } from "@/lib/supabase/server";

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
      // TODO: Implement session end
      // 1. Update session status to "ended"
      // 2. Delete LiveKit room
      // 3. Clear Redis cache (running_order, pending_proposal, agent_context, lock)
      // 4. Log session_ended event
      // 5. Generate and return session summary

      return NextResponse.json(
        { error: "Not implemented", sessionId },
        { status: 501 }
      );
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
