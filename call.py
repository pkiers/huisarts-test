"""
Start a real-time voice conversation with your ElevenLabs agent.

Uses the ElevenLabs SDK's built-in audio interface for microphone input
and speaker output. Requires a working microphone and speakers.

Usage:
    python call.py                    # Uses AGENT_ID from .env
    python call.py <agent_id>        # Uses provided agent ID
"""

import os
import sys
import signal
from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs
from elevenlabs.conversational_ai.conversation import Conversation
from elevenlabs.conversational_ai.default_audio_interface import DefaultAudioInterface

load_dotenv()

api_key = os.getenv("ELEVENLABS_API_KEY")
agent_id = sys.argv[1] if len(sys.argv) > 1 else os.getenv("AGENT_ID")

if not api_key:
    print("Error: ELEVENLABS_API_KEY niet gevonden in .env")
    sys.exit(1)

if not agent_id:
    print("Error: AGENT_ID niet gevonden. Geef het mee als argument of zet het in .env")
    print("Maak eerst een agent aan met: python create_agent.py")
    sys.exit(1)

elevenlabs = ElevenLabs(api_key=api_key)

conversation = Conversation(
    client=elevenlabs,
    agent_id=agent_id,
    requires_auth=False,
    audio_interface=DefaultAudioInterface(),
    callback_agent_response=lambda text: print(f"\n🤖 Agent: {text}"),
    callback_user_transcript=lambda text: print(f"\n🎤 Jij: {text}"),
)

# Graceful shutdown op Ctrl+C
signal.signal(signal.SIGINT, lambda *_: conversation.end_session())

print("=" * 50)
print("  Voice Conversation gestart!")
print("  Model: Eleven v3 Conversational (expressive)")
print("  Druk op Ctrl+C om te stoppen")
print("=" * 50)
print()

conversation.start_session()
conversation.wait_for_session_end()

print("\nGesprek beëindigd.")
