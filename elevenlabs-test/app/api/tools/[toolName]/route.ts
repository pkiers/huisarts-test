import { NextRequest, NextResponse } from "next/server";
import { handleToolCall } from "../../../lib/tool-handlers";

/**
 * Webhook handler for ElevenLabs server-side tool calls (SIP/phone path).
 * ElevenLabs POSTs tool parameters here, expects JSON result back.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ toolName: string }> }
) {
  const { toolName } = await params;

  try {
    const body = await request.json();
    const result = handleToolCall(toolName, body);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
