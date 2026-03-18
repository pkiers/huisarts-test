import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const since = parseInt(request.nextUrl.searchParams.get("since") || "0");
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.LIVEKIT_URL;

  if (!apiKey || !apiSecret || !livekitUrl) {
    return NextResponse.json({ connected: false, events: [], ended: false });
  }

  const httpUrl = livekitUrl.replace("ws://", "http://").replace("wss://", "https://");

  try {
    const token = await createToken(apiKey, apiSecret);

    // 1. Find active huisarts room
    const roomsRes = await fetch(`${httpUrl}/twirp/livekit.RoomService/ListRooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
    });

    if (!roomsRes.ok) {
      return NextResponse.json({ connected: false, events: [], ended: false });
    }

    const roomsData = await roomsRes.json();
    const rooms = (roomsData.rooms || []) as Array<{ name: string; num_participants: number }>;
    const activeRoom = rooms.find(
      (r) => r.name.startsWith("huisarts-") && r.num_participants > 0
    );

    if (!activeRoom) {
      return NextResponse.json({ connected: false, events: [], ended: false });
    }

    // 2. Get participants — need a room-scoped token
    const roomToken = await createToken(apiKey, apiSecret, activeRoom.name);
    const partRes = await fetch(`${httpUrl}/twirp/livekit.RoomService/ListParticipants`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${roomToken}` },
      body: JSON.stringify({ room: activeRoom.name }),
    });

    if (!partRes.ok) {
      const errText = await partRes.text();
      return NextResponse.json({ connected: true, events: [], ended: false, room: activeRoom.name, debug: `listParticipants failed: ${partRes.status} ${errText}` });
    }

    const partData = await partRes.json();
    const participants = (partData.participants || []) as Array<{ identity: string; metadata: string; is_publisher: boolean }>;

    // Debug: log participant info
    console.log("Participants:", JSON.stringify(participants.map((p) => ({
      identity: p.identity,
      metadata: p.metadata ? p.metadata.substring(0, 100) : null,
    }))));

    // Find the agent participant (has JSON metadata with events)
    let agentMeta: { events?: Array<{ type: string; [key: string]: unknown }> } | null = null;
    for (const p of participants) {
      if (!p.metadata) continue;
      try {
        const parsed = JSON.parse(p.metadata);
        if (parsed.events) {
          agentMeta = parsed;
          break;
        }
      } catch {
        // not JSON, skip
      }
    }

    if (!agentMeta || !agentMeta.events) {
      return NextResponse.json({ connected: true, events: [], ended: false, room: activeRoom.name, debug: "no_metadata" });
    }

    // 3. Parse events from agent metadata
    const meta = agentMeta;
    const allEvents: Array<{ type: string; [key: string]: unknown }> = meta.events || [];

    // Return events after `since` index
    const newEvents = allEvents.slice(since).map((e, i) => ({ ...e, id: since + i + 1 }));

    return NextResponse.json({
      connected: true,
      events: newEvents,
      ended: false,
      room: activeRoom.name,
      total: allEvents.length,
    });
  } catch (error) {
    console.error("call/status error:", error);
    return NextResponse.json({ connected: false, events: [], ended: false });
  }
}

async function createToken(apiKey: string, apiSecret: string, roomName?: string): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const video: Record<string, unknown> = { roomList: true, roomAdmin: true, roomCreate: true };
  if (roomName) {
    video.room = roomName;
  }
  const claims = {
    iss: apiKey,
    nbf: now,
    exp: now + 60,
    sub: "api",
    video,
  };

  const enc = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

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
