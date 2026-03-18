import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.ELEVENLABS_API_KEY!;
const AGENT_ID = process.env.AGENT_ID!;

export async function GET() {
  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}`,
      { headers: { "xi-api-key": API_KEY } }
    );
    if (!res.ok) throw new Error(await res.text());
    const agent = await res.json();

    const prompt = agent.conversation_config?.agent?.prompt?.prompt || "";
    const tools = (agent.conversation_config?.agent?.prompt?.tools || []).map(
      (t: Record<string, unknown>) => ({
        type: t.type,
        name: t.name,
        description: t.description,
        ...(t.type === "webhook" ? { url: t.url } : {}),
      })
    );
    const firstMessage =
      agent.conversation_config?.agent?.first_message || "";
    const voiceId = agent.conversation_config?.tts?.voice_id || "";
    const speed = agent.conversation_config?.tts?.speed || 1.0;

    return NextResponse.json({
      name: agent.name,
      prompt,
      tools,
      firstMessage,
      voiceId,
      speed,
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to fetch agent: ${error}` },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    // Build the update payload — only update what was sent
    const conversationConfig: Record<string, unknown> = {};

    if (body.prompt !== undefined || body.firstMessage !== undefined) {
      conversationConfig.agent = {
        ...(body.firstMessage !== undefined
          ? { first_message: body.firstMessage }
          : {}),
        ...(body.prompt !== undefined
          ? { prompt: { prompt: body.prompt } }
          : {}),
      };
    }

    if (body.speed !== undefined || body.voiceId !== undefined) {
      conversationConfig.tts = {
        ...(body.voiceId !== undefined ? { voice_id: body.voiceId } : {}),
        ...(body.speed !== undefined ? { speed: body.speed } : {}),
        model_id: "eleven_v3_conversational",
      };
    }

    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}`,
      {
        method: "PATCH",
        headers: {
          "xi-api-key": API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ conversation_config: conversationConfig }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: res.status });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to update agent: ${error}` },
      { status: 500 }
    );
  }
}
