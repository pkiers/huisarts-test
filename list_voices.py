"""List available voices to find a good Dutch-compatible voice."""

import os
from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs

load_dotenv()

elevenlabs = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))

response = elevenlabs.voices.get_all()

for voice in response.voices:
    labels = dict(voice.labels) if voice.labels else {}
    lang = labels.get("language", "")
    print(f"{voice.voice_id}  {voice.name:<25} lang={lang}")
