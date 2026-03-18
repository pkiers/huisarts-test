"""
Huisarts Voice AI Agent
Bridges LiveKit SIP phone calls to ElevenLabs Conversational AI or Gemini Live
via raw audio.

Supports two backends controlled by VOICE_PROVIDER env var:
- "elevenlabs" (default): WebSocket to ElevenLabs Conversational AI
- "gemini": Vertex AI Gemini Live with native audio
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
GEMINI_OUTPUT_RATE = 24000  # Gemini Live outputs 24kHz PCM
LIVEKIT_RATE = 24000  # LiveKit default sample rate

DEFAULT_PROVIDER = os.environ.get("VOICE_PROVIDER", "elevenlabs").lower()
ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY", "")
ELEVENLABS_AGENT_ID = os.environ.get("ELEVENLABS_AGENT_ID", "")

LIVEKIT_URL = os.environ.get("LIVEKIT_URL", "ws://localhost:7880")
LIVEKIT_API_KEY = os.environ.get("LIVEKIT_API_KEY", "")
LIVEKIT_API_SECRET = os.environ.get("LIVEKIT_API_SECRET", "")


async def get_active_provider() -> str:
    """Read provider preference from LiveKit config room metadata."""
    try:
        from livekit import api as lk_api
        lk = lk_api.LiveKitAPI(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        rooms = await lk.room.list_rooms(lk_api.ListRoomsRequest())
        for room in rooms.rooms:
            if room.name == "huisarts-config" and room.metadata:
                config = json.loads(room.metadata)
                provider = config.get("provider", DEFAULT_PROVIDER)
                logger.info("Provider from config room: %s", provider)
                await lk.aclose()
                return provider
        await lk.aclose()
    except Exception as e:
        logger.warning("Failed to read provider from config room: %s", e)
    return DEFAULT_PROVIDER

server = AgentServer(num_idle_processes=1)


# --- System prompt (shared between ElevenLabs and Gemini) ---

SYSTEM_PROMPT = """Je bent de telefoonassistent van Huisartspraktijk De Gezondheid. Je naam is Lisa.
Je helpt patiënten vriendelijk en professioneel via de telefoon.

## Kerntaken
1. **Triage**: Beoordeel de urgentie van klachten
2. **Afspraken**: Help met het plannen van afspraken
3. **Herhaalrecepten**: Verwerk aanvragen voor herhaalrecepten
4. **Doorverbinden**: Verbind door naar medewerkers wanneer nodig
5. **Berichten**: Neem berichten aan voor de praktijk

## Gespreksrichtlijnen
- Spreek altijd Nederlands
- Wees warm, empathisch en professioneel
- Houd antwoorden kort: maximaal 2-3 zinnen per beurt
- Vraag bij het eerste contact naar naam en geboortedatum voor identificatie

## Triage Protocol
- **SPOED** (bel 112 of escaleer direct):
  - Pijn op de borst / hartklachten
  - Ademnood
  - Bewusteloosheid
  - Ernstige bloeding
  - Vermoeden van beroerte (scheef gezicht, arm niet optillen, spraakproblemen)
- **URGENT** (dezelfde dag afspraak):
  - Hoge koorts (>39°C) langer dan 2 dagen
  - Acute buikpijn
  - Wonden die gehecht moeten worden
- **REGULIER** (binnen een week):
  - Aanhoudende klachten
  - Controle afspraken
  - Niet-acute vragen

## Workflow
1. Begroet de patiënt en vraag naar voornaam EN achternaam
2. Vraag naar de geboortedatum ter verificatie
3. Vraag naar de reden van het telefoontje
4. Bij klachten: doe een korte triage, vraag door naar symptomen
5. Bied de juiste actie aan:
   - Afspraak? → Vraag wanneer het uitkomt, check beschikbaarheid, boek
   - Herhaalrecept? → Vraag welk medicijn en dosering
   - Arts spreken? → Leg uit dat je een afspraak kunt inplannen of een terugbelverzoek kunt doen
   - Terugbellen? → Vraag naar telefoonnummer en voorkeurstijd

## BELANGRIJK: Wat je NIET kunt
- Je kunt NIET doorverbinden met een arts of medewerker
- Je kunt NIET direct een arts aan de lijn krijgen
- Als iemand vraagt om doorverbonden te worden, bied dan aan:
  1. Een afspraak in te plannen bij de arts
  2. Een terugbelverzoek in te dienen zodat de arts terugbelt
  3. Een bericht achter te laten voor de arts
6. Herhaal altijd de afspraakdetails ter bevestiging (datum, tijd, arts, reden)
7. Sluit vriendelijk af

## Belangrijk bij afspraken
- Vraag ALTIJD naar de reden/klacht voor de afspraak
- Vraag of de patiënt voorkeur heeft voor een bepaalde arts
- Noem de beschikbare tijdslots en laat de patiënt kiezen
- Bevestig na het boeken: "Uw afspraak staat gepland op [datum] om [tijd] bij [arts] voor [reden]"
"""


# --- Fake demo data for tool calls ---

FAKE_PATIENTS = {
    "kiers": {
        "name": "Peter Kiers",
        "dob": "21-02-1983",
        "bsn": "123456789",
        "huisarts": "Dr. Van der Berg",
        "allergies": ["Penicilline"],
        "medications": ["Omeprazol 20mg", "Metformine 500mg"],
    },
    "jansen": {
        "name": "Maria Jansen",
        "dob": "15-03-1985",
        "bsn": "987654321",
        "huisarts": "Dr. Van der Berg",
        "allergies": [],
        "medications": ["Lisinopril 10mg"],
    },
    "de vries": {
        "name": "Pieter de Vries",
        "dob": "22-08-1972",
        "bsn": "456789123",
        "huisarts": "Dr. Bakker",
        "allergies": [],
        "medications": ["Metformine 500mg"],
    },
    "dijkstra": {
        "name": "Siebrand Dijkstra",
        "dob": "15-05-1968",
        "bsn": "789123456",
        "huisarts": "Dr. Van der Berg",
        "allergies": [],
        "medications": ["Atorvastatine 40mg"],
    },
}
DEFAULT_PATIENT = "kiers"  # fallback if no match

FAKE_SLOTS = [
    {"date": (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d"), "time": "09:00", "doctor": "Dr. Van der Berg"},
    {"date": (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d"), "time": "10:30", "doctor": "Dr. Bakker"},
    {"date": (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d"), "time": "14:00", "doctor": "Dr. Van der Berg"},
    {"date": (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d"), "time": "08:30", "doctor": "Dr. Bakker"},
    {"date": (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d"), "time": "11:00", "doctor": "Dr. Van der Berg"},
    {"date": (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d"), "time": "09:30", "doctor": "Dr. Bakker"},
]


def handle_tool_call(tool_name: str, args: dict) -> dict:
    """Handle a tool call and return the result."""
    if tool_name == "check_availability":
        doctor = args.get("doctor", "")
        slots = [s for s in FAKE_SLOTS if not doctor or doctor.lower() in s["doctor"].lower()][:4]
        return {"slots": slots}

    elif tool_name == "book_appointment":
        return {
            "confirmation": True,
            "date": args.get("date", "morgen"),
            "time": args.get("time", "09:00"),
            "doctor": args.get("doctor", "Dr. Van der Berg"),
            "reason": args.get("reason", "Consult"),
            "reference": f"AF-{datetime.now().strftime('%Y%m%d')}-001",
        }

    elif tool_name == "get_patient_info":
        name = args.get("name", "").lower()
        for key, p in FAKE_PATIENTS.items():
            if key in name or name in p["name"].lower():
                return p
        return FAKE_PATIENTS[DEFAULT_PATIENT]

    elif tool_name == "escalate_urgent":
        return {
            "escalated": True,
            "reason": args.get("reason", ""),
            "urgency": args.get("urgency_level", "high"),
            "action": "Wordt direct doorverbonden met dienstdoende arts",
        }

    elif tool_name == "request_repeat_prescription":
        return {
            "requested": True,
            "medication": args.get("medication", ""),
            "dosage": args.get("dosage", ""),
            "reference": f"RX-{datetime.now().strftime('%Y%m%d')}-001",
            "status": "In behandeling - ophalen over 24 uur bij apotheek",
        }

    elif tool_name == "transfer_to_staff":
        return {
            "transferring": True,
            "department": args.get("department", "receptie"),
            "status": "Wordt doorverbonden...",
        }

    elif tool_name == "schedule_callback":
        return {
            "scheduled": True,
            "name": args.get("name", ""),
            "phone": args.get("phone_number", ""),
            "preferred_time": args.get("preferred_time", "zo snel mogelijk"),
            "reference": f"CB-{datetime.now().strftime('%Y%m%d')}-001",
        }

    elif tool_name == "leave_message":
        return {
            "saved": True,
            "name": args.get("name", ""),
            "message": args.get("message", ""),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M"),
        }

    return {"error": f"Unknown tool: {tool_name}"}


# Buffer of all events sent during a call
_event_history: list[dict] = []


def _send_event(room: rtc.Room, event_type: str, data: dict):
    """Send event and store in agent's participant metadata for polling."""
    event = {"type": event_type, **data}
    _event_history.append(event)
    # Store full history in agent's metadata so it can be fetched via LiveKit API
    metadata = json.dumps({"events": _event_history[-100:]})

    async def _update_metadata():
        try:
            await room.local_participant.set_metadata(metadata)
        except Exception as e:
            logger.error("Failed to set metadata: %s", e)

    asyncio.ensure_future(_update_metadata())
    logger.info("Event stored: %s (total: %d)", event_type, len(_event_history))


async def wait_for_participant(room: rtc.Room) -> rtc.RemoteParticipant:
    """Wait for a remote participant to join the room."""
    if room.remote_participants:
        return list(room.remote_participants.values())[0]
    fut: asyncio.Future[rtc.RemoteParticipant] = asyncio.get_event_loop().create_future()

    def on_join(p: rtc.RemoteParticipant):
        if not fut.done():
            fut.set_result(p)

    room.on("participant_connected", on_join)
    return await fut


# =============================================================================
# ElevenLabs backend
# =============================================================================

async def _run_elevenlabs(room: rtc.Room, participant: rtc.RemoteParticipant, stopped: asyncio.Event):
    """Run the ElevenLabs Conversational AI backend."""
    import websockets
    import httpx

    # Set up LiveKit audio I/O
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
    resampler_down = rtc.AudioResampler(  # LiveKit 24kHz -> ElevenLabs 16kHz
        input_rate=LIVEKIT_RATE,
        output_rate=SAMPLE_RATE,
        num_channels=1,
    )
    resampler_up = rtc.AudioResampler(  # ElevenLabs 16kHz -> LiveKit 24kHz
        input_rate=SAMPLE_RATE,
        output_rate=LIVEKIT_RATE,
        num_channels=1,
    )

    # Get signed URL for the agent
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id={ELEVENLABS_AGENT_ID}",
            headers={"xi-api-key": ELEVENLABS_API_KEY},
        )
        resp.raise_for_status()
        signed_url = resp.json()["signed_url"]

    logger.info("Connecting to ElevenLabs Conversational AI...")
    ws = await websockets.connect(
        signed_url,
        additional_headers={"Origin": "https://elevenlabs.io"},
    )
    logger.info("Connected to ElevenLabs")

    # Wait for conversation_initiation_metadata before starting audio
    init_msg = await asyncio.wait_for(ws.recv(), timeout=10)
    init_data = json.loads(init_msg)
    conv_id = init_data.get("conversation_initiation_metadata_event", {}).get("conversation_id", "")
    logger.info("ElevenLabs init: type=%s conversation_id=%s full_keys=%s",
                init_data.get("type", ""),
                conv_id,
                list(init_data.keys()))
    logger.info("ElevenLabs init full: %s", json.dumps(init_data)[:2000])

    def _on_leave(p: rtc.RemoteParticipant):
        if p.identity == participant.identity:
            logger.info("Participant left")
            stopped.set()

    room.on("participant_disconnected", _on_leave)

    # Send audio from LiveKit -> ElevenLabs
    async def send_audio():
        try:
            async for event in audio_stream:
                if stopped.is_set():
                    break
                pcm = bytes(event.frame.data)
                for frame_16k in resampler_down.push(
                    rtc.AudioFrame(
                        data=pcm,
                        sample_rate=LIVEKIT_RATE,
                        num_channels=1,
                        samples_per_channel=len(pcm) // 2,
                    )
                ):
                    resampled = bytes(frame_16k.data)
                    audio_b64 = base64.b64encode(resampled).decode("utf-8")
                    msg = {"user_audio_chunk": audio_b64}
                    await ws.send(json.dumps(msg))
        except Exception as e:
            logger.error("send_audio error: %s", e)
            stopped.set()

    # Receive from ElevenLabs -> LiveKit + handle events
    async def receive_audio():
        try:
            async for raw_msg in ws:
                if stopped.is_set():
                    break
                msg = json.loads(raw_msg)
                msg_type = msg.get("type", "")
                if msg_type not in ("audio", "ping"):
                    logger.info("ElevenLabs msg: type=%s keys=%s", msg_type, list(msg.keys()))

                if msg_type == "audio":
                    audio_event = msg.get("audio_event", {})
                    chunk_b64 = audio_event.get("audio_base_64")
                    if chunk_b64:
                        pcm_data = base64.b64decode(chunk_b64)
                        frame_16k = rtc.AudioFrame(
                            data=pcm_data,
                            sample_rate=SAMPLE_RATE,
                            num_channels=1,
                            samples_per_channel=len(pcm_data) // 2,
                        )
                        for frame_24k in resampler_up.push(frame_16k):
                            await audio_source.capture_frame(frame_24k)

                elif msg_type == "user_transcript":
                    text = msg.get("user_transcription_event", {}).get("user_transcript", "")
                    if text:
                        logger.info("User: %s", text)
                        _send_event(room, "transcript", {
                            "role": "user",
                            "text": text,
                            "timestamp": datetime.now().isoformat(),
                        })

                elif msg_type == "agent_response":
                    text = msg.get("agent_response_event", {}).get("agent_response", "")
                    if text:
                        logger.info("Agent: %s", text)
                        _send_event(room, "transcript", {
                            "role": "agent",
                            "text": text,
                            "timestamp": datetime.now().isoformat(),
                        })

                elif msg_type == "client_tool_call":
                    tool_call = msg.get("client_tool_call", {})
                    tool_name = tool_call.get("tool_name", "")
                    tool_call_id = tool_call.get("tool_call_id", "")
                    parameters = tool_call.get("parameters", {})
                    logger.info("Tool call: %s(%s)", tool_name, parameters)

                    result = handle_tool_call(tool_name, parameters)

                    _send_event(room, "tool_call", {
                        "tool": tool_name,
                        "args": parameters,
                        "result": result,
                    })

                    response = {
                        "type": "client_tool_result",
                        "tool_call_id": tool_call_id,
                        "result": json.dumps(result),
                        "is_error": False,
                    }
                    await ws.send(json.dumps(response))
                    logger.info("Tool result sent: %s", tool_name)

                elif msg_type == "conversation_initiation_metadata":
                    logger.info("Conversation initialized: %s", msg.get("conversation_id", ""))

                elif msg_type == "ping":
                    event_id = msg.get("ping_event", {}).get("event_id", 0)
                    await ws.send(json.dumps({"type": "pong", "event_id": event_id}))

                elif msg_type == "error":
                    logger.error("ElevenLabs error: %s", msg)

        except Exception as e:
            if "websockets" in type(e).__module__:
                logger.info("ElevenLabs WebSocket closed: %s", e)
            else:
                logger.error("receive_audio error: %s", e)
        finally:
            stopped.set()

    # Run audio bridge
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


# =============================================================================
# Gemini Live backend
# =============================================================================

def _build_gemini_tools():
    """Build Gemini tool declarations matching the 7 huisarts tools."""
    from google.genai import types

    return [types.Tool(function_declarations=[
        types.FunctionDeclaration(
            name="check_availability",
            description="Bekijk beschikbare tijdslots voor afspraken bij de huisarts. Gebruik dit wanneer een patiënt een afspraak wil maken.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "doctor": types.Schema(type=types.Type.STRING, description="Naam van de gewenste arts (optioneel)"),
                    "date": types.Schema(type=types.Type.STRING, description="Gewenste datum (YYYY-MM-DD formaat, optioneel)"),
                    "urgency": types.Schema(type=types.Type.STRING, description="Urgentieniveau van de afspraak (regulier, urgent, spoed)"),
                },
            ),
        ),
        types.FunctionDeclaration(
            name="book_appointment",
            description="Boek een afspraak voor de patiënt. Gebruik dit nadat je beschikbaarheid hebt gecheckt en de patiënt een tijdslot heeft gekozen.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "date": types.Schema(type=types.Type.STRING, description="Datum van de afspraak (YYYY-MM-DD)"),
                    "time": types.Schema(type=types.Type.STRING, description="Tijd van de afspraak (HH:MM)"),
                    "doctor": types.Schema(type=types.Type.STRING, description="Naam van de arts"),
                    "reason": types.Schema(type=types.Type.STRING, description="Reden voor de afspraak"),
                    "patient_name": types.Schema(type=types.Type.STRING, description="Naam van de patiënt"),
                },
                required=["date", "time", "reason"],
            ),
        ),
        types.FunctionDeclaration(
            name="get_patient_info",
            description="Zoek patiëntgegevens op in het systeem. Gebruik dit om de identiteit van de beller te verifiëren.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "name": types.Schema(type=types.Type.STRING, description="Naam van de patiënt"),
                    "date_of_birth": types.Schema(type=types.Type.STRING, description="Geboortedatum (DD-MM-YYYY)"),
                },
                required=["name"],
            ),
        ),
        types.FunctionDeclaration(
            name="escalate_urgent",
            description="Escaleer een spoedgeval naar de dienstdoende arts. Gebruik dit bij SPOED situaties zoals pijn op de borst, ademnood, of bewusteloosheid.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "reason": types.Schema(type=types.Type.STRING, description="Beschrijving van de spoedsituatie"),
                    "urgency_level": types.Schema(type=types.Type.STRING, description="Urgentieniveau (high, critical)"),
                    "patient_name": types.Schema(type=types.Type.STRING, description="Naam van de patiënt"),
                    "symptoms": types.Schema(type=types.Type.STRING, description="Beschrijving van symptomen"),
                },
                required=["reason", "urgency_level"],
            ),
        ),
        types.FunctionDeclaration(
            name="request_repeat_prescription",
            description="Vraag een herhaalrecept aan voor een patiënt. Gebruik dit wanneer een patiënt medicijnen wil laten bijschrijven.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "medication": types.Schema(type=types.Type.STRING, description="Naam van het medicijn"),
                    "dosage": types.Schema(type=types.Type.STRING, description="Dosering van het medicijn"),
                    "patient_name": types.Schema(type=types.Type.STRING, description="Naam van de patiënt"),
                    "pharmacy": types.Schema(type=types.Type.STRING, description="Naam van de apotheek (optioneel)"),
                },
                required=["medication", "patient_name"],
            ),
        ),
        types.FunctionDeclaration(
            name="schedule_callback",
            description="Plan een terugbelverzoek in. Gebruik dit wanneer de patiënt teruggebeld wil worden.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "name": types.Schema(type=types.Type.STRING, description="Naam van de patiënt"),
                    "phone_number": types.Schema(type=types.Type.STRING, description="Telefoonnummer om terug te bellen"),
                    "preferred_time": types.Schema(type=types.Type.STRING, description="Gewenst tijdstip voor terugbellen"),
                    "reason": types.Schema(type=types.Type.STRING, description="Reden voor het terugbelverzoek"),
                },
                required=["name", "phone_number"],
            ),
        ),
        types.FunctionDeclaration(
            name="leave_message",
            description="Laat een bericht achter voor de praktijk. Gebruik dit wanneer de patiënt een boodschap wil achterlaten.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "name": types.Schema(type=types.Type.STRING, description="Naam van de persoon"),
                    "message": types.Schema(type=types.Type.STRING, description="Het bericht dat achtergelaten moet worden"),
                    "callback_requested": types.Schema(type=types.Type.BOOLEAN, description="Of er teruggebeld moet worden"),
                    "phone_number": types.Schema(type=types.Type.STRING, description="Telefoonnummer (als terugbellen gewenst)"),
                },
                required=["name", "message"],
            ),
        ),
    ])]


async def _run_gemini(room: rtc.Room, participant: rtc.RemoteParticipant, stopped: asyncio.Event):
    """Run the Gemini Live backend via Vertex AI."""
    from google import genai
    from google.genai import types

    project = os.environ.get("GOOGLE_CLOUD_PROJECT", "babbel-dev")
    location = os.environ.get("GOOGLE_CLOUD_LOCATION", "europe-west1")

    client = genai.Client(vertexai=True, project=project, location=location)
    model = "gemini-live-2.5-flash-native-audio"

    tools = _build_gemini_tools()

    config = types.LiveConnectConfig(
        response_modalities=[types.Modality.AUDIO],
        speech_config=types.SpeechConfig(
            language_code="nl-NL",
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Kore")
            ),
        ),
        system_instruction=types.Content(
            parts=[types.Part(text=SYSTEM_PROMPT)]
        ),
        tools=tools,
        input_audio_transcription=types.AudioTranscriptionConfig(),
        output_audio_transcription=types.AudioTranscriptionConfig(),
    )

    # Set up LiveKit audio I/O
    audio_stream = rtc.AudioStream.from_participant(
        participant=participant,
        track_source=rtc.TrackSource.SOURCE_MICROPHONE,
        sample_rate=LIVEKIT_RATE,
        num_channels=1,
    )
    audio_source = rtc.AudioSource(sample_rate=LIVEKIT_RATE, num_channels=1)
    track = rtc.LocalAudioTrack.create_audio_track("agent_audio", audio_source)
    await room.local_participant.publish_track(track)

    # Resampler: LiveKit 24kHz -> Gemini 16kHz input
    resampler_down = rtc.AudioResampler(
        input_rate=LIVEKIT_RATE,
        output_rate=SAMPLE_RATE,
        num_channels=1,
    )
    # Gemini outputs 24kHz which matches LiveKit, so no upsampling needed

    logger.info("Connecting to Gemini Live (project=%s, location=%s)...", project, location)
    session_cm = client.aio.live.connect(model=model, config=config)
    session = await session_cm.__aenter__()
    logger.info("Connected to Gemini Live")

    def _on_leave(p: rtc.RemoteParticipant):
        if p.identity == participant.identity:
            logger.info("Participant left")
            stopped.set()

    room.on("participant_disconnected", _on_leave)

    # Send audio from LiveKit -> Gemini
    async def send_audio():
        try:
            async for event in audio_stream:
                if stopped.is_set():
                    break
                pcm = bytes(event.frame.data)
                # Resample 24kHz -> 16kHz for Gemini input
                for frame_16k in resampler_down.push(
                    rtc.AudioFrame(
                        data=pcm,
                        sample_rate=LIVEKIT_RATE,
                        num_channels=1,
                        samples_per_channel=len(pcm) // 2,
                    )
                ):
                    resampled = bytes(frame_16k.data)
                    await session.send_realtime_input(
                        audio=types.Blob(data=resampled, mime_type="audio/pcm;rate=16000")
                    )
        except Exception as e:
            logger.error("send_audio error: %s", e)
            stopped.set()

    # Receive from Gemini -> LiveKit + handle events
    # Send greeting to kick off conversation
    await session.send(input="Begroet de beller vriendelijk als Lisa van Huisartspraktijk De Gezondheid. Vraag naar hun naam.", end_of_turn=True)
    logger.info("Greeting sent to Gemini")

    async def receive_responses():
        audio_logged = False
        agent_text = ""
        user_text = ""
        try:
            while not stopped.is_set():
                logger.info("Starting session.receive() loop")
                async for response in session.receive():
                    if stopped.is_set():
                        break

                    # Handle tool calls
                    tc = response.tool_call
                    if tc:
                        function_responses = []
                        for fc in tc.function_calls:
                            tool_name = fc.name
                            parameters = dict(fc.args) if fc.args else {}
                            logger.info("Tool call: %s(%s)", tool_name, parameters)

                            result = handle_tool_call(tool_name, parameters)
                            _send_event(room, "tool_call", {
                                "tool": tool_name,
                                "args": parameters,
                                "result": result,
                            })

                            function_responses.append(
                                types.FunctionResponse(
                                    name=fc.name,
                                    id=fc.id,
                                    response=result,
                                )
                            )

                        await session.send_tool_response(function_responses=function_responses)
                        logger.info("Tool responses sent: %d", len(function_responses))
                        continue

                    # Handle server content (audio, transcriptions, turn complete)
                    sc = response.server_content
                    if not sc:
                        continue

                    if sc.model_turn:
                        for part in sc.model_turn.parts:
                            if part.inline_data and part.inline_data.data:
                                pcm_data = part.inline_data.data
                                if isinstance(pcm_data, str):
                                    pcm_data = base64.b64decode(pcm_data)
                                if not audio_logged:
                                    logger.info("Gemini audio: type=%s len=%d mime=%s",
                                               type(part.inline_data.data).__name__,
                                               len(pcm_data),
                                               getattr(part.inline_data, 'mime_type', 'unknown'))
                                    audio_logged = True
                                frame_24k = rtc.AudioFrame(
                                    data=pcm_data,
                                    sample_rate=GEMINI_OUTPUT_RATE,
                                    num_channels=1,
                                    samples_per_channel=len(pcm_data) // 2,
                                )
                                await audio_source.capture_frame(frame_24k)

                    if sc.output_transcription and sc.output_transcription.text:
                        agent_text += sc.output_transcription.text

                    if sc.input_transcription and sc.input_transcription.text:
                        user_text += sc.input_transcription.text

                    if sc.turn_complete:
                        # Flush accumulated transcripts at turn boundary
                        if agent_text.strip():
                            logger.info("Agent: %s", agent_text.strip())
                            _send_event(room, "transcript", {
                                "role": "agent",
                                "text": agent_text.strip(),
                                "timestamp": datetime.now().isoformat(),
                            })
                            agent_text = ""
                        if user_text.strip():
                            logger.info("User: %s", user_text.strip())
                            _send_event(room, "transcript", {
                                "role": "user",
                                "text": user_text.strip(),
                                "timestamp": datetime.now().isoformat(),
                            })
                            user_text = ""
                        logger.info("Turn complete")

                    if sc.interrupted:
                        logger.info("Interrupted")
                        audio_source.clear_queue()
                        if agent_text.strip():
                            _send_event(room, "transcript", {
                                "role": "agent",
                                "text": agent_text.strip(),
                                "timestamp": datetime.now().isoformat(),
                            })
                            agent_text = ""

                logger.info("session.receive() iterator ended, restarting...")

        except Exception as e:
            logger.error("receive_responses error: %s", e)
        finally:
            stopped.set()

    # Run audio bridge
    try:
        send_task = asyncio.create_task(send_audio())
        recv_task = asyncio.create_task(receive_responses())

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
            await session_cm.__aexit__(None, None, None)
        except Exception:
            pass


# =============================================================================
# Entrypoint
# =============================================================================

@server.rtc_session()
async def entrypoint(ctx: JobContext):
    await ctx.connect()
    room = ctx.room

    # Skip non-call rooms (e.g. huisarts-config used for provider toggle)
    if room.name == "huisarts-config" or not room.name.startswith("huisarts-_"):
        logger.info("Skipping non-call room: %s", room.name)
        return

    # Read provider from LiveKit config room (set by frontend toggle)
    provider = await get_active_provider()
    logger.info("Agent started in room %s (provider=%s)", room.name, provider)

    # Clear event history for new call
    _event_history.clear()

    # 1. Wait for SIP participant
    participant = await wait_for_participant(room)
    logger.info("Participant joined: %s", participant.identity)

    _send_event(room, "call_started", {
        "participant": participant.identity,
        "room": room.name,
        "timestamp": datetime.now().isoformat(),
        "provider": provider,
    })

    stopped = asyncio.Event()

    try:
        if provider == "gemini":
            await _run_gemini(room, participant, stopped)
        else:
            await _run_elevenlabs(room, participant, stopped)
    finally:
        _send_event(room, "call_ended", {
            "timestamp": datetime.now().isoformat(),
        })
        logger.info("Session ended")


if __name__ == "__main__":
    cli.run_app(server)
