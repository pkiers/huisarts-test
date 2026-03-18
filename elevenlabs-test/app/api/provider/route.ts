import { NextRequest, NextResponse } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";

const CONFIG_ROOM = "huisarts-config";

function getRoomService(): RoomServiceClient {
  const url = process.env.LIVEKIT_URL || "ws://localhost:7880";
  const httpUrl = url.replace("ws://", "http://").replace("wss://", "https://");
  return new RoomServiceClient(
    httpUrl,
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_API_SECRET!
  );
}

// GET — read current provider
export async function GET() {
  try {
    const roomService = getRoomService();
    const rooms = await roomService.listRooms();
    const configRoom = rooms.find((r) => r.name === CONFIG_ROOM);

    if (configRoom?.metadata) {
      const config = JSON.parse(configRoom.metadata);
      return NextResponse.json({ provider: config.provider || "elevenlabs" });
    }

    return NextResponse.json({ provider: "elevenlabs" });
  } catch {
    return NextResponse.json({ provider: "elevenlabs" });
  }
}

// POST — set provider
export async function POST(request: NextRequest) {
  try {
    const { provider } = await request.json();

    if (!["elevenlabs", "gemini"].includes(provider)) {
      return NextResponse.json(
        { error: "Invalid provider. Must be 'elevenlabs' or 'gemini'" },
        { status: 400 }
      );
    }

    const roomService = getRoomService();
    const metadata = JSON.stringify({ provider });

    // Create or update the config room
    try {
      await roomService.createRoom({
        name: CONFIG_ROOM,
        emptyTimeout: 0, // never expire
        metadata,
      });
    } catch {
      // Room may already exist, update metadata
      await roomService.updateRoomMetadata(CONFIG_ROOM, metadata);
    }

    return NextResponse.json({ provider, ok: true });
  } catch {
    // If LiveKit is unreachable, still acknowledge the request
    return NextResponse.json({ ok: true });
  }
}
