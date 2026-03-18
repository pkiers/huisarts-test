"""Update agent settings for faster responses."""

import os
from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs

load_dotenv()

elevenlabs = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))

agent_id = os.getenv("AGENT_ID")
elevenlabs.conversational_ai.agents.update(
    agent_id=agent_id,
    conversation_config={
        "tts": {
            "voice_id": "XJa38TJgDqYhj5mYbSJA",
            "model_id": "eleven_v3_conversational",
            "optimize_streaming_latency": 4,
            "speed": 1.0,
        },
        "turn": {
            "turn_eagerness": "eager",
        },
        "agent": {
            "prompt": {
                "prompt": """
Je bent een vriendelijke, behulpzame en expressieve AI-assistent die via voice communiceert.
Je spreekt Nederlands tenzij de gebruiker een andere taal spreekt.

Gedrag:
- Wees warm en empathisch in je reacties.
- Gebruik expressieve elementen waar passend: [laughs] bij humor, [whispers] voor vertrouwelijke momenten, [sighs] bij empathie, [excited] bij goed nieuws.
- Houd antwoorden HEEL KORT — maximaal 1-2 zinnen per beurt.
- Vraag door als iets onduidelijk is.
- Pas je toon aan op basis van de emotie van de gebruiker.
- Vermijd lange monologen — dit is een gesprek, geen lezing.
""",
                "llm": "gemini-2.5-flash",
                "temperature": 0.0,
            },
        },
    },
)

print(f"Agent {agent_id} updated:"
      "\n  - optimize_streaming_latency: 4 (max)"
      "\n  - turn_eagerness: eager"
      "\n  - Shorter prompt responses (1-2 zinnen)")
