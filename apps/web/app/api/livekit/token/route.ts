import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/livekit/token
 *
 * Generates a short-lived LiveKit access token for the producer to join a room.
 * Also sets room metadata so the agent can read the session_id.
 */
export async function POST(request: Request) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    // Validate user is authenticated
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

    if (!apiKey || !apiSecret || !livekitUrl) {
      console.error("[livekit/token] Missing LIVEKIT_API_KEY, LIVEKIT_API_SECRET, or NEXT_PUBLIC_LIVEKIT_URL");
      return NextResponse.json(
        { error: "LiveKit credentials not configured" },
        { status: 500 }
      );
    }

    // Room name must be consistent — the agent worker will be dispatched to this room
    const roomName = `sudriv-${sessionId}`;

    // Create access token for the producer
    const token = new AccessToken(apiKey, apiSecret, {
      identity: `producer-${authData.user.id}`,
      name: authData.user.email?.split("@")[0] || "Producer",
      metadata: JSON.stringify({
        role: "producer",
        sessionId,
      }),
    });

    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const jwt = await token.toJwt();

    console.log(`[livekit/token] Token generated for room: ${roomName}, user: ${authData.user.email}`);

    return NextResponse.json({
      token: jwt,
      roomName,
      url: livekitUrl,
    });
  } catch (error) {
    console.error("[livekit/token] Failed to generate token:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
