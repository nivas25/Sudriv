import { NextResponse } from "next/server";
import {
  AgentDispatchClient,
  JobRestartPolicy,
  RoomServiceClient,
} from "livekit-server-sdk";
import { createClient } from "@/lib/supabase/server";
import {
  SUDRIV_AGENT_NAME,
  livekitHttpHost,
  roomNameForSession,
} from "@/lib/livekit/config";

/**
 * POST /api/livekit/ensure-agent
 *
 * Called by the UI when the room is connected but no agent participant is
 * present. Re-dispatches the Sudriv worker so conversation can resume
 * without a full page reload / re-greet (agent greets only once per session).
 */
export async function POST(request: Request) {
  try {
    const { sessionId } = await request.json();
    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
    if (!apiKey || !apiSecret || !livekitUrl) {
      return NextResponse.json(
        { error: "LiveKit credentials not configured" },
        { status: 500 },
      );
    }

    const roomName = roomNameForSession(sessionId);
    const httpHost = livekitHttpHost(livekitUrl);
    const metadata = JSON.stringify({
      session_id: sessionId,
      user_id: authData.user.id,
      reason: "ensure-agent",
    });

    // Ensure room still exists (producer may still be in it)
    const rooms = new RoomServiceClient(httpHost, apiKey, apiSecret);
    try {
      const existing = await rooms.listRooms([roomName]);
      if (!existing.length) {
        await rooms.createRoom({
          name: roomName,
          emptyTimeout: 60 * 30,
          departureTimeout: 60,
          metadata,
        });
      }
    } catch (e) {
      console.warn(
        "[ensure-agent] list/create room:",
        e instanceof Error ? e.message : e,
      );
    }

    const dispatch = new AgentDispatchClient(httpHost, apiKey, apiSecret);

    // Avoid stampeding duplicate dispatches if one is already pending
    try {
      const current = await dispatch.listDispatch(roomName);
      const active = current.filter((d) => d.agentName === SUDRIV_AGENT_NAME);
      if (active.length > 0) {
        console.info(
          `[ensure-agent] dispatch already present room=${roomName} count=${active.length}`,
        );
        return NextResponse.json({
          ok: true,
          roomName,
          action: "already_dispatched",
          count: active.length,
        });
      }
    } catch (e) {
      console.warn(
        "[ensure-agent] listDispatch:",
        e instanceof Error ? e.message : e,
      );
    }

    const created = await dispatch.createDispatch(
      roomName,
      SUDRIV_AGENT_NAME,
      {
        metadata,
        restartPolicy: JobRestartPolicy.JRP_ON_FAILURE,
      },
    );

    console.info(
      `[ensure-agent] created dispatch room=${roomName} id=${created.id} agent=${SUDRIV_AGENT_NAME}`,
    );

    return NextResponse.json({
      ok: true,
      roomName,
      action: "dispatched",
      dispatchId: created.id,
      agentName: SUDRIV_AGENT_NAME,
    });
  } catch (error) {
    console.error("[ensure-agent] failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to ensure agent",
      },
      { status: 500 },
    );
  }
}
