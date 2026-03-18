"""
Create an ElevenLabs Conversational AI Agent with Eleven v3 Conversational (expressive mode).

Expressive mode is enabled by default with the eleven_v3_conversational model.
The agent uses expressive tags like [laughs], [whispers], [sighs], [slow], [excited]
for natural, emotionally aware conversations.
"""

import os
from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs

load_dotenv()

elevenlabs = ElevenLabs(
    api_key=os.getenv("ELEVENLABS_API_KEY"),
)

SYSTEM_PROMPT = """
Je bent een vriendelijke, behulpzame en expressieve AI-assistent die via voice communiceert.
Je spreekt Nederlands tenzij de gebruiker een andere taal spreekt.

Gedrag:
- Wees warm en empathisch in je reacties.
- Gebruik expressieve elementen waar passend: [laughs] bij humor, [whispers] voor vertrouwelijke momenten, [sighs] bij empathie, [excited] bij goed nieuws.
- Houd antwoorden kort en conversationeel — maximaal 2-3 zinnen per beurt.
- Vraag door als iets onduidelijk is.
- Pas je toon aan op basis van de emotie van de gebruiker.

Richtlijnen:
- Als de gebruiker blij klinkt, wees enthousiast mee.
- Als de gebruiker gefrustreerd klinkt, wees kalm en begripvol.
- Vermijd lange monologen — dit is een gesprek, geen lezing.
"""

response = elevenlabs.conversational_ai.agents.create(
    name="Voice Assistant v3 Expressive",
    tags=["v3-conversational", "expressive"],
    conversation_config={
        "tts": {
            "voice_id": "gdTrLNuwWUaxC0z5n1j7",  # Jerry - Warm and conversational Dutch Voice
            "model_id": "eleven_v3_conversational",  # Enables expressive mode by default
        },
        "agent": {
            "first_message": "Hallo! Leuk dat je belt. Waar kan ik je mee helpen?",
            "prompt": {
                "prompt": SYSTEM_PROMPT,
            },
        },
    },
)

print(f"Agent aangemaakt! Agent ID: {response.agent_id}")
print(f"Sla dit ID op in je .env als AGENT_ID={response.agent_id}")
