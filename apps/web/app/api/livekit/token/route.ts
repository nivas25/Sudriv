import { NextResponse } from "next/server";
import {
  AccessToken,
  AgentDispatchClient,
  RoomServiceClient,
  RoomAgentDispatch,
  RoomConfiguration,
  JobRestartPolicy,
} from "livekit-server-sdk";
import { createClient } from "@/lib/supabase/server";
import {
  SUDRIV_AGENT_NAME,
  livekitHttpHost,
  roomNameForSession,
} from "@/lib/livekit/config";

/**
 * POST /api/livekit/token
 *
 * Issues a producer token AND dispatches the named Sudriv agent into the room.
 * Worker must register with the same agent_name (default: "sudriv").
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
      console.error(
        "[livekit/token] Missing LIVEKIT_API_KEY, LIVEKIT_API_SECRET, or NEXT_PUBLIC_LIVEKIT_URL",
      );
      return NextResponse.json(
        { error: "LiveKit credentials not configured" },
        { status: 500 },
      );
    }

    const roomName = roomNameForSession(sessionId);
    const roomMetadata = JSON.stringify({
      session_id: sessionId,
      user_id: authData.user.id,
    });

    const agentDispatch = new RoomAgentDispatch({
      agentName: SUDRIV_AGENT_NAME,
      metadata: roomMetadata,
      restartPolicy: JobRestartPolicy.JRP_ON_FAILURE,
    });

    const httpHost = livekitHttpHost(livekitUrl);
    const rooms = new RoomServiceClient(httpHost, apiKey, apiSecret);

    try {
      await rooms.createRoom({
        name: roomName,
        emptyTimeout: 60 * 30,
        departureTimeout: 60,
        metadata: roomMetadata,
        agents: [agentDispatch],
      });
      console.info("[livekit/token] room created", roomName);
    } catch (roomErr) {
      console.info(
        "[livekit/token] createRoom (may already exist):",
        roomErr instanceof Error ? roomErr.message : roomErr,
      );
      try {
        await rooms.updateRoomMetadata(roomName, roomMetadata);
      } catch {
        // non-fatal
      }
      // Ensure agent is dispatched even if room already exists
      try {
        const dispatch = new AgentDispatchClient(httpHost, apiKey, apiSecret);
        const existing = await dispatch.listDispatch(roomName);
        const hasOurs = existing.some((d) => d.agentName === SUDRIV_AGENT_NAME);
        if (!hasOurs) {
          await dispatch.createDispatch(roomName, SUDRIV_AGENT_NAME, {
            metadata: roomMetadata,
            restartPolicy: JobRestartPolicy.JRP_ON_FAILURE,
          });
          console.info("[livekit/token] agent dispatch created", roomName);
        }
      } catch (dispErr) {
        console.warn(
          "[livekit/token] explicit dispatch:",
          dispErr instanceof Error ? dispErr.message : dispErr,
        );
      }
    }

    const token = new AccessToken(apiKey, apiSecret, {
      identity: `producer-${authData.user.id}`,
      name: authData.user.email?.split("@")[0] || "Producer",
      ttl: "6h",
      metadata: JSON.stringify({
        role: "producer",
        sessionId,
      }),
    });

    token.addGrant({
      roomJoin: true,
      room: roomName,
      roomCreate: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      canUpdateOwnMetadata: true,
    });

    // Dispatch named agent when this participant joins
    try {
      token.roomConfig = new RoomConfiguration({
        agents: [agentDispatch],
      });
    } catch (cfgErr) {
      console.warn(
        "[livekit/token] roomConfig skipped:",
        cfgErr instanceof Error ? cfgErr.message : cfgErr,
      );
    }

    const jwt = await token.toJwt();

    console.log(
      `[livekit/token] token ok room=${roomName} agent=${SUDRIV_AGENT_NAME} user=${authData.user.email}`,
    );

    return NextResponse.json({
      token: jwt,
      roomName,
      url: livekitUrl,
      agentName: SUDRIV_AGENT_NAME,
    });
  } catch (error) {
    console.error("[livekit/token] Failed to generate token:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
