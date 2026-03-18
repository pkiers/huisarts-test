import { NextResponse } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";

export async function GET() {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.LIVEKIT_URL;

  if (!apiKey || !apiSecret || !livekitUrl) {
    return NextResponse.json({ rooms: [] });
  }

  try {
    const httpUrl = livekitUrl.replace("ws://", "http://").replace("wss://", "https://");
    const roomService = new RoomServiceClient(httpUrl, apiKey, apiSecret);
    const rooms = await roomService.listRooms();

    const huisartsRooms = rooms
      .filter((r) => r.name.startsWith("huisarts-_"))
      .map((r) => ({
        name: r.name,
        numParticipants: r.numParticipants,
      }));

    return NextResponse.json({ rooms: huisartsRooms });
  } catch {
    return NextResponse.json({ rooms: [] });
  }
}
