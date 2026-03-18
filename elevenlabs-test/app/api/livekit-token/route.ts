import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";

export async function GET(request: NextRequest) {
  const room = request.nextUrl.searchParams.get("room");
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.LIVEKIT_URL;

  if (!apiKey || !apiSecret || !livekitUrl || !room) {
    return NextResponse.json({ error: "Missing config" }, { status: 500 });
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity: `viewer-${Date.now()}`,
    ttl: "1h",
  });
  at.addGrant({ room, roomJoin: true, canPublish: false, canSubscribe: true });

  const token = await at.toJwt();
  return NextResponse.json({ token, url: livekitUrl });
}
