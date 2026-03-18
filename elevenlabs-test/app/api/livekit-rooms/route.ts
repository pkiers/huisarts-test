import { NextResponse } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";

export async function GET() {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.LIVEKIT_URL;

  if (!apiKey || !apiSecret || !livekitUrl) {
    return NextResponse.json(
      { error: "Missing LiveKit configuration" },
      { status: 500 }
    );
  }

  try {
    // RoomServiceClient needs http(s) URL
    const httpUrl = livekitUrl.replace("ws://", "http://").replace("wss://", "https://");
    const roomService = new RoomServiceClient(httpUrl, apiKey, apiSecret);
    const rooms = await roomService.listRooms();

    // Filter for huisarts- rooms only
    const huisartsRooms = rooms
      .filter((r) => r.name.startsWith("huisarts-"))
      .map((r) => ({
        name: r.name,
        numParticipants: r.numParticipants,
        creationTime: r.creationTime ? Number(r.creationTime) * 1000 : 0,
      }));

    return NextResponse.json({ rooms: huisartsRooms });
  } catch {
    // Return empty if LiveKit is unreachable (e.g. from Vercel serverless)
    return NextResponse.json({ rooms: [] });
  }
}
