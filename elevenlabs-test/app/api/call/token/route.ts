import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.LIVEKIT_URL;

  if (!apiKey || !apiSecret || !livekitUrl) {
    return NextResponse.json(
      { error: "Missing LIVEKIT_URL, LIVEKIT_API_KEY, or LIVEKIT_API_SECRET" },
      { status: 500 }
    );
  }

  try {
    // List rooms via LiveKit API to find active huisarts room
    const res = await fetch(`${livekitUrl.replace("ws", "http")}/twirp/livekit.RoomService/ListRooms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await createToken(apiKey, apiSecret)}`,
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to list rooms" }, { status: 500 });
    }

    const data = await res.json();
    const rooms = (data.rooms || []) as Array<{ name: string; num_participants: number }>;
    const activeRoom = rooms.find(
      (r) => r.name.startsWith("huisarts-") && r.num_participants > 0
    );

    if (!activeRoom) {
      return NextResponse.json({ error: "No active call", room: null }, { status: 200 });
    }

    // Generate viewer token for this room
    const token = await createToken(apiKey, apiSecret, activeRoom.name, "viewer");

    return NextResponse.json({
      token,
      room: activeRoom.name,
      livekitUrl,
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to get token: ${error}` },
      { status: 500 }
    );
  }
}

async function createToken(
  apiKey: string,
  apiSecret: string,
  room?: string,
  identity?: string
): Promise<string> {
  // Simple JWT creation for LiveKit
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);

  const claims: Record<string, unknown> = {
    iss: apiKey,
    nbf: now,
    exp: now + 3600,
    sub: identity || "api",
  };

  if (room && identity) {
    claims.video = {
      room,
      roomJoin: true,
      canSubscribe: true,
      canPublish: false,
      canPublishData: true, // needed to send request_history
    };
  } else {
    // Admin token for listing rooms
    claims.video = {
      roomList: true,
    };
  }

  const enc = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const headerB64 = enc(header);
  const payloadB64 = enc(claims);
  const data = `${headerB64}.${payloadB64}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(apiSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return `${data}.${sigB64}`;
}
