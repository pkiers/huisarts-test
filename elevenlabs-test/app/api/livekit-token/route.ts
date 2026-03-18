import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";

export async function GET(request: NextRequest) {
  const room = request.nextUrl.searchParams.get("room");

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.LIVEKIT_URL;

  if (!apiKey || !apiSecret || !livekitUrl) {
    return NextResponse.json(
      { error: "Missing LiveKit configuration" },
      { status: 500 }
    );
  }

  // Generate a viewer token — can subscribe to data but no audio publish
  const identity = `viewer-${Date.now()}`;
  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    ttl: "1h",
  });

  if (room) {
    // Join a specific room
    at.addGrant({
      room,
      roomJoin: true,
      canPublish: false,
      canSubscribe: true,
    });
  } else {
    // Grant access to any huisarts- room
    at.addGrant({
      roomJoin: true,
      canPublish: false,
      canSubscribe: true,
    });
  }

  const token = await at.toJwt();

  return NextResponse.json({
    token,
    url: livekitUrl,
  });
}
