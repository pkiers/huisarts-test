"""
Huisarts Voice AI Agent
Bridges LiveKit SIP phone calls to ElevenLabs Conversational AI via raw audio.

Phone (Voys) → LiveKit SIP → this agent → ElevenLabs WebSocket → audio back to phone
Transcript + tool call events → LiveKit data channel → frontend
"""

import asyncio
import base64
import json
import logging
import os
from datetime import datetime, timedelta

from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import AgentServer, JobContext, cli

load_dotenv()

logger = logging.getLogger("huisarts-agent")
logger.setLevel(logging.INFO)

SAMPLE_RATE = 16000  # ElevenLabs expects 16kHz PCM
LIVEKIT_RATE = 24000  # LiveKit default sample rate
ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY", "")
ELEVENLABS_AGENT_ID = os.environ.get("ELEVENLABS_AGENT_ID", "")

server = AgentServer(num_idle_processes=1)


# --- Fake demo data ---

FAKE_PATIENTS = {
    "kiers": {
        "name": "Peter Kiers", "dob": "21-02-1983", "bsn": "123456789",
        "huisarts": "Dr. Van der Berg", "allergies": ["Penicilline"],
        "medications": ["Omeprazol 20mg", "Metformine 500mg"],
    },
    "jansen": {
        "name": "Maria Jansen", "dob": "15-03-1985", "bsn": "987654321",
        "huisarts": "Dr. Van der Berg", "allergies": [],
        "medications": ["Lisinopril 10mg"],
    },
    "de vries": {
        "name": "Pieter de Vries", "dob": "22-08-1972", "bsn": "456789123",
        "huisarts": "Dr. Bakker", "allergies": [],
        "medications": ["Metformine 500mg"],
    },
    "dijkstra": {
        "name": "Siebrand Dijkstra", "dob": "15-05-1968", "bsn": "789123456",
        "huisarts": "Dr. Van der Berg", "allergies": [],
        "medications": ["Atorvastatine 40mg"],
    },
}

FAKE_SLOTS = [
    {"date": (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d"), "time": "09:00", "doctor": "Dr. Van der Berg"},
    {"date": (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d"), "time": "10:30", "doctor": "Dr. Bakker"},
    {"date": (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d"), "time": "14:00", "doctor": "Dr. Van der Berg"},
    {"date": (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d"), "time": "08:30", "doctor": "Dr. Bakker"},
]


def handle_tool_call(tool_name: str, args: dict) -> dict:
    if tool_name == "check_availability":
        return {"slots": FAKE_SLOTS}
    elif tool_name == "book_appointment":
        return {
            "confirmation": True, "date": args.get("date", "morgen"),
            "time": args.get("time", "09:00"), "doctor": args.get("doctor", "Dr. Van der Berg"),
            "reason": args.get("reason", "Consult"),
            "reference": f"AF-{datetime.now().strftime('%Y%m%d')}-001",
        }
    elif tool_name == "get_patient_info":
        name = args.get("name", "").lower().strip()
        dob = args.get("date_of_birth", "").strip()
        # Find candidates by name
        candidates = []
        for key, p in FAKE_PATIENTS.items():
            p_name = p["name"].lower()
            p_last = p["name"].split()[-1].lower()
            if key in name or p_name in name or name in p_name or p_last in name or name in p_last:
                candidates.append(p)
        # Verify DOB if provided
        if dob and candidates:
            dob_clean = dob.replace(" ", "").lower()
            verified = [p for p in candidates if dob_clean in p["dob"].replace(" ", "").lower() or p["dob"].replace(" ", "").lower() in dob_clean]
            if verified:
                return {**verified[0], "found": True}
            return {"found": False, "error": "Geboortedatum komt niet overeen. Controleer de gegevens nogmaals."}
        if candidates:
            return {**candidates[0], "found": True}
        return {"found": False, "error": "Patiënt niet gevonden. Controleer de voornaam, achternaam en geboortedatum nogmaals. De patiënt moet ingeschreven staan bij de praktijk."}
    elif tool_name == "escalate_urgent":
        return {"escalated": True, "reason": args.get("reason", ""),
                "urgency": args.get("urgency_level", "high"),
                "action": "Wordt direct doorverbonden met dienstdoende arts"}
    elif tool_name == "request_repeat_prescription":
        return {"requested": True, "medication": args.get("medication", ""),
                "dosage": args.get("dosage", ""),
                "reference": f"RX-{datetime.now().strftime('%Y%m%d')}-001",
                "status": "In behandeling - ophalen over 24 uur bij apotheek"}
    elif tool_name == "schedule_callback":
        return {"scheduled": True, "name": args.get("name", ""),
                "phone": args.get("phone_number", ""),
                "preferred_time": args.get("preferred_time", "zo snel mogelijk"),
                "reference": f"CB-{datetime.now().strftime('%Y%m%d')}-001"}
    elif tool_name == "leave_message":
        return {"saved": True, "name": args.get("name", ""),
                "message": args.get("message", ""),
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M")}
    return {"error": f"Unknown tool: {tool_name}"}


# --- Event publishing ---

_event_history: list[dict] = []


def _send_event(room: rtc.Room, event_type: str, data: dict):
    event = {"type": event_type, **data}
    _event_history.append(event)
    payload = json.dumps(event).encode()

    async def _publish():
        try:
            await room.local_participant.publish_data(payload, reliable=True)
        except Exception as e:
            logger.error("Failed to publish data: %s", e)

    asyncio.ensure_future(_publish())


# --- Helpers ---

async def wait_for_participant(room: rtc.Room) -> rtc.RemoteParticipant:
    if room.remote_participants:
        return list(room.remote_participants.values())[0]
    fut: asyncio.Future[rtc.RemoteParticipant] = asyncio.get_event_loop().create_future()

    def on_join(p: rtc.RemoteParticipant):
        if not fut.done():
            fut.set_result(p)

    room.on("participant_connected", on_join)
    return await fut


# --- Entrypoint ---

@server.rtc_session()
async def entrypoint(ctx: JobContext):
    await ctx.connect()
    room = ctx.room

    if not room.name.startswith("huisarts-_"):
        logger.info("Skipping non-call room: %s", room.name)
        return

    logger.info("Agent started in room %s", room.name)
    _event_history.clear()

    participant = await wait_for_participant(room)
    logger.info("Participant joined: %s", participant.identity)

    _send_event(room, "call_started", {
        "participant": participant.identity,
        "room": room.name,
        "timestamp": datetime.now().isoformat(),
    })

    # When a viewer joins late, replay all past events
    def _on_viewer_join(p: rtc.RemoteParticipant):
        if p.identity.startswith("viewer-") and _event_history:
            async def _replay():
                for event in _event_history:
                    payload = json.dumps(event).encode()
                    await room.local_participant.publish_data(payload, reliable=True)
                logger.info("Replayed %d events to viewer %s", len(_event_history), p.identity)
            asyncio.ensure_future(_replay())

    room.on("participant_connected", _on_viewer_join)

    # LiveKit audio I/O
    audio_stream = rtc.AudioStream.from_participant(
        participant=participant,
        track_source=rtc.TrackSource.SOURCE_MICROPHONE,
        sample_rate=LIVEKIT_RATE,
        num_channels=1,
    )
    audio_source = rtc.AudioSource(sample_rate=LIVEKIT_RATE, num_channels=1)
    track = rtc.LocalAudioTrack.create_audio_track("agent_audio", audio_source)
    await room.local_participant.publish_track(track)

    # Resamplers
    resampler_down = rtc.AudioResampler(input_rate=LIVEKIT_RATE, output_rate=SAMPLE_RATE, num_channels=1)
    resampler_up = rtc.AudioResampler(input_rate=SAMPLE_RATE, output_rate=LIVEKIT_RATE, num_channels=1)

    # Connect to ElevenLabs
    import websockets
    import httpx

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id={ELEVENLABS_AGENT_ID}",
            headers={"xi-api-key": ELEVENLABS_API_KEY},
        )
        resp.raise_for_status()
        signed_url = resp.json()["signed_url"]

    logger.info("Connecting to ElevenLabs...")
    ws = await websockets.connect(signed_url, additional_headers={"Origin": "https://elevenlabs.io"})
    logger.info("Connected to ElevenLabs")

    init_msg = await asyncio.wait_for(ws.recv(), timeout=10)
    init_data = json.loads(init_msg)
    conv_id = init_data.get("conversation_initiation_metadata_event", {}).get("conversation_id", "")
    logger.info("Conversation started: %s", conv_id)

    stopped = asyncio.Event()

    def _on_leave(p: rtc.RemoteParticipant):
        if p.identity == participant.identity:
            logger.info("Participant left")
            stopped.set()

    room.on("participant_disconnected", _on_leave)

    # Send audio: LiveKit → ElevenLabs (buffered to ~100ms chunks)
    async def send_audio():
        CHUNK_SAMPLES = SAMPLE_RATE // 10  # 1600 samples = 100ms at 16kHz
        CHUNK_BYTES = CHUNK_SAMPLES * 2     # 3200 bytes (16-bit PCM)
        audio_buffer = bytearray()
        send_count = 0
        try:
            async for event in audio_stream:
                if stopped.is_set():
                    break
                pcm = bytes(event.frame.data)
                for frame_16k in resampler_down.push(
                    rtc.AudioFrame(data=pcm, sample_rate=LIVEKIT_RATE, num_channels=1, samples_per_channel=len(pcm) // 2)
                ):
                    audio_buffer.extend(bytes(frame_16k.data))
                    while len(audio_buffer) >= CHUNK_BYTES:
                        chunk = bytes(audio_buffer[:CHUNK_BYTES])
                        del audio_buffer[:CHUNK_BYTES]
                        # Pre-encode message to minimize await time
                        msg = json.dumps({"user_audio_chunk": base64.b64encode(chunk).decode()})
                        await ws.send(msg)
                        send_count += 1
                        if send_count == 1:
                            logger.info("First audio chunk sent to ElevenLabs (%d bytes)", len(chunk))
        except Exception as e:
            logger.error("send_audio error: %s", e)
            stopped.set()

    # Receive from ElevenLabs → LiveKit
    async def receive_audio():
        import time as _time
        first_audio_received = False
        last_user_speech_end = 0.0
        try:
            async for raw_msg in ws:
                if stopped.is_set():
                    break
                msg = json.loads(raw_msg)
                msg_type = msg.get("type", "")

                if msg_type == "audio":
                    chunk_b64 = msg.get("audio_event", {}).get("audio_base_64")
                    if chunk_b64:
                        if not first_audio_received:
                            first_audio_received = True
                            if last_user_speech_end > 0:
                                latency = (_time.time() - last_user_speech_end) * 1000
                                logger.info("LATENCY: first agent audio %.0fms after user speech end", latency)
                        pcm_data = base64.b64decode(chunk_b64)
                        frame_16k = rtc.AudioFrame(data=pcm_data, sample_rate=SAMPLE_RATE, num_channels=1, samples_per_channel=len(pcm_data) // 2)
                        for frame_24k in resampler_up.push(frame_16k):
                            await audio_source.capture_frame(frame_24k)

                elif msg_type == "user_transcript":
                    text = msg.get("user_transcription_event", {}).get("user_transcript", "")
                    if text:
                        last_user_speech_end = _time.time()
                        first_audio_received = False
                        logger.info("User: %s", text)
                        _send_event(room, "transcript", {"role": "user", "text": text, "timestamp": datetime.now().isoformat()})

                elif msg_type == "agent_response":
                    text = msg.get("agent_response_event", {}).get("agent_response", "")
                    if text:
                        logger.info("Agent: %s", text)
                        _send_event(room, "transcript", {"role": "agent", "text": text, "timestamp": datetime.now().isoformat()})

                elif msg_type == "client_tool_call":
                    tc = msg.get("client_tool_call", {})
                    tool_name, tool_call_id = tc.get("tool_name", ""), tc.get("tool_call_id", "")
                    parameters = tc.get("parameters", {})
                    logger.info("Tool call: %s(%s)", tool_name, parameters)
                    result = handle_tool_call(tool_name, parameters)
                    _send_event(room, "tool_call", {"tool": tool_name, "args": parameters, "result": result})
                    await ws.send(json.dumps({"type": "client_tool_result", "tool_call_id": tool_call_id, "result": json.dumps(result), "is_error": False}))
                    logger.info("Tool result sent: %s", tool_name)

                elif msg_type == "ping":
                    event_id = msg.get("ping_event", {}).get("event_id", 0)
                    await ws.send(json.dumps({"type": "pong", "event_id": event_id}))

                elif msg_type not in ("audio", "ping", "conversation_initiation_metadata"):
                    logger.info("ElevenLabs: %s", msg_type)

        except Exception as e:
            if "websockets" in type(e).__module__:
                logger.info("ElevenLabs WebSocket closed: %s", e)
            else:
                logger.error("receive_audio error: %s", e)
        finally:
            stopped.set()

    # Run
    try:
        send_task = asyncio.create_task(send_audio())
        recv_task = asyncio.create_task(receive_audio())
        await stopped.wait()
        send_task.cancel()
        recv_task.cancel()
        for t in (send_task, recv_task):
            try:
                await t
            except (asyncio.CancelledError, Exception):
                pass
    finally:
        try:
            await ws.close()
        except Exception:
            pass
        _send_event(room, "call_ended", {"timestamp": datetime.now().isoformat()})
        logger.info("Session ended")


if __name__ == "__main__":
    cli.run_app(server)
