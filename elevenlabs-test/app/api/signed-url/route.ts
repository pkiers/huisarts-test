import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.NEXT_PUBLIC_AGENT_ID || process.env.AGENT_ID;

  if (!apiKey || !agentId) {
    return NextResponse.json(
      { error: "Missing ELEVENLABS_API_KEY or AGENT_ID" },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`,
      {
        headers: {
          "xi-api-key": apiKey,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: `ElevenLabs API error: ${error}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ signedUrl: data.signed_url });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to get signed URL: ${error}` },
      { status: 500 }
    );
  }
}
