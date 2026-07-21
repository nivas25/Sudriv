import { NextResponse } from "next/server";
// import { AccessToken } from "livekit-server-sdk";

/**
 * POST /api/livekit/token
 *
 * Generates a short-lived LiveKit access token for the producer to join a room.
 * Called by the frontend when starting a session.
 *
 * See: knowledge-base/07-frontend-architecture.md (Token Generation)
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

    // TODO: Validate that the session exists and belongs to the authenticated user

    // TODO: Generate LiveKit token
    // const token = new AccessToken(
    //   process.env.LIVEKIT_API_KEY!,
    //   process.env.LIVEKIT_API_SECRET!,
    //   {
    //     identity: `producer-${sessionId}`,
    //     name: "Producer",
    //     metadata: JSON.stringify({ role: "producer", sessionId }),
    //   }
    // );
    //
    // token.addGrant({
    //   room: `sudriv-session-${sessionId}`,
    //   roomJoin: true,
    //   canPublish: true,
    //   canSubscribe: true,
    //   canPublishData: true,
    // });
    //
    // return NextResponse.json({
    //   token: await token.toJwt(),
    //   roomName: `sudriv-session-${sessionId}`,
    //   url: process.env.NEXT_PUBLIC_LIVEKIT_URL,
    // });

    return NextResponse.json(
      { error: "Not implemented — configure LiveKit credentials" },
      { status: 501 }
    );
  } catch (error) {
    console.error("Failed to generate LiveKit token:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
