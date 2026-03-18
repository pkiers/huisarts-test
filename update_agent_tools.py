"""
Update the ElevenLabs Conversational AI Agent with huisarts tools and system prompt.
"""

import os
from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs

load_dotenv()

elevenlabs = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))

AGENT_ID = os.getenv("AGENT_ID", "agent_7801kkzsqjsqe15svpfegj23b4k8")
WEBHOOK_BASE_URL = os.getenv("WEBHOOK_BASE_URL", "https://huisarts-test.vercel.app/api/tools")

SYSTEM_PROMPT = """Je bent de telefoonassistent van Huisartspraktijk De Gezondheid. Je naam is Lisa.
Je helpt patiënten vriendelijk en professioneel via de telefoon.

## Toon en expressie
- Begin het gesprek altijd [excited] en enthousiast — je vindt het leuk om mensen te helpen!
- Gebruik expressieve tags: [excited] bij begroeting en goed nieuws
- Wees warm, energiek en oprecht geïnteresseerd in de beller

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
- Gebruik [sighs] bij empathie, [excited] bij goed nieuws

## Triage Protocol (NTS — Nederlandse Triage Standaard)

Bij medische klachten voer je triage uit volgens de NTS-systematiek. Gebruik de ABCDE-benadering om de urgentie te bepalen.

### ABCDE-benadering (altijd in deze volgorde checken)

**A — Airway (Luchtweg)**
- Vraag: "Kunt u normaal praten? Heeft u het gevoel dat uw keel dichtgaat?"
- Alarmsignalen: stridor, niet kunnen praten/slikken, zwelling in keel/mond
- Bij obstructie → direct U1

**B — Breathing (Ademhaling)**
- Vraag: "Kunt u goed ademhalen? Bent u kortademig? Hoeveel woorden kunt u achter elkaar zeggen?"
- Check: ademfrequentie, piepen, benauwdheid, cyanose (blauwe lippen)
- Alarmsignalen: ernstige dyspnoe, <10 of >30 ademhalingen/min, niet in zinnen kunnen praten
- Ernstig → U1, matig → U2

**C — Circulation (Circulatie)**
- Vraag: "Voelt u zich duizelig? Bent u flauwgevallen? Heeft u pijn op de borst? Ziet u bloed?"
- Check: pols (snel/langzaam/onregelmatig), bleekheid, zweten, bloedverlies
- Alarmsignalen: pijn op de borst, syncope, actieve bloeding, shock-verschijnselen
- Pijn op borst/bewusteloos → U1, hemodynamisch instabiel → U1

**D — Disability (Neurologisch)**
- Vraag: "Bent u helder? Weet u waar u bent? Kunt u uw armen en benen bewegen? Hangt uw gezicht scheef?"
- Check: bewustzijn, pupillen, motoriek, spraak
- Alarmsignalen: verwardheid, uitvalsverschijnselen, insulten, vermoeden CVA (FAST: Face-Arms-Speech-Time)
- Bewustzijnsverlies/CVA-verdenking → U1

**E — Exposure (Overig)**
- Vraag: "Heeft u koorts? Hoe hoog? Heeft u uitslag? Heeft u ergens pijn?"
- Check: temperatuur, huidafwijkingen, pijn, allergische reactie
- Alarmsignalen: anafylaxie, meningeale prikkeling (koorts + nekstijfheid + vlekjes)

### NTS Urgentieniveaus

**U1 — Levensbedreigend** (onmiddellijke actie, bel 112)
Escaleer DIRECT via `escalate_urgent` tool met urgency_level "critical"
- Bewusteloosheid / niet aanspreekbaar
- Ernstige ademhalingsproblemen / ademstilstand
- Pijn op de borst (verdenking hartinfarct)
- Vermoeden CVA/beroerte (FAST positief)
- Ernstige allergische reactie (anafylaxie)
- Ernstig trauma met actieve bloeding
- Insult (epileptische aanval, nu bezig)

**U2 — Spoed** (zo snel mogelijk, <1 uur)
Escaleer via `escalate_urgent` tool met urgency_level "high"
- Hoge koorts (>40°C) met ernstig ziek zijn
- Acute hevige buikpijn
- Grote wonden die gehecht moeten worden
- Botbreuken met misstand
- Acute psychiatrische crisis (suïcidaliteit)
- Kind <3 maanden met koorts >38°C

**U3 — Urgent** (dezelfde dag, binnen enkele uren)
Plan een spoedafspraak in via `book_appointment` met urgency "urgent"
- Koorts >39°C langer dan 2 dagen
- Matige buikpijn met bijkomende klachten
- Urineweginfectie met koorts
- Oorpijn bij kinderen met koorts
- Aanhoudend braken/diarree (dehydratierisico)
- Plotselinge doofheid of visusklachten

**U4 — Niet urgent** (binnen 24 uur tot een week)
Plan een reguliere afspraak via `book_appointment`
- Aanhoudende klachten zonder alarmsignalen
- Huidklachten (uitslag, eczeem)
- Lichte rugpijn, gewrichtsklachten
- Verkoudheid/hoest >2 weken
- Controleafspraken

**U5 — Advies** (telefonisch advies volstaat)
Geef zelfzorgadvies, geen afspraak nodig
- Lichte verkoudheid, keelpijn
- Insectenbeet zonder allergische reactie
- Kleine schaafwonden
- Vragen over medicijnen

### Triage-werkwijze
1. Luister naar de klacht en stel de ABCDE-vragen die relevant zijn
2. Stel MAXIMAAL 3-4 gerichte vragen — niet alles hoeft gevraagd
3. Bepaal de urgentie (U1-U5) op basis van de antwoorden
4. Bij twijfel: kies altijd het hogere urgentieniveau
5. Voer de bijbehorende actie uit (escaleren / afspraak / advies)

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

TOOLS = [
    {
        "type": "webhook",
        "name": "check_availability",
        "description": "Bekijk beschikbare tijdslots voor afspraken bij de huisarts. Gebruik dit wanneer een patiënt een afspraak wil maken.",
        "parameters": {
            "type": "object",
            "properties": {
                "doctor": {
                    "type": "string",
                    "description": "Naam van de gewenste arts (optioneel)"
                },
                "date": {
                    "type": "string",
                    "description": "Gewenste datum (YYYY-MM-DD formaat, optioneel)"
                },
                "urgency": {
                    "type": "string",
                    "enum": ["regulier", "urgent", "spoed"],
                    "description": "Urgentieniveau van de afspraak"
                }
            },
            "required": []
        }
    },
    {
        "type": "webhook",
        "name": "book_appointment",
        "description": "Boek een afspraak voor de patiënt. Gebruik dit nadat je beschikbaarheid hebt gecheckt en de patiënt een tijdslot heeft gekozen.",
        "parameters": {
            "type": "object",
            "properties": {
                "date": {
                    "type": "string",
                    "description": "Datum van de afspraak (YYYY-MM-DD)"
                },
                "time": {
                    "type": "string",
                    "description": "Tijd van de afspraak (HH:MM)"
                },
                "doctor": {
                    "type": "string",
                    "description": "Naam van de arts"
                },
                "reason": {
                    "type": "string",
                    "description": "Reden voor de afspraak"
                },
                "patient_name": {
                    "type": "string",
                    "description": "Naam van de patiënt"
                }
            },
            "required": ["date", "time", "reason"]
        }
    },
    {
        "type": "webhook",
        "name": "get_patient_info",
        "description": "Zoek patiëntgegevens op in het systeem. Gebruik dit om de identiteit van de beller te verifiëren.",
        "parameters": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Naam van de patiënt"
                },
                "date_of_birth": {
                    "type": "string",
                    "description": "Geboortedatum (DD-MM-YYYY)"
                }
            },
            "required": ["name"]
        }
    },
    {
        "type": "webhook",
        "name": "escalate_urgent",
        "description": "Escaleer een spoedgeval naar de dienstdoende arts. Gebruik dit bij SPOED situaties zoals pijn op de borst, ademnood, of bewusteloosheid.",
        "parameters": {
            "type": "object",
            "properties": {
                "reason": {
                    "type": "string",
                    "description": "Beschrijving van de spoedsituatie"
                },
                "urgency_level": {
                    "type": "string",
                    "enum": ["high", "critical"],
                    "description": "Urgentieniveau"
                },
                "patient_name": {
                    "type": "string",
                    "description": "Naam van de patiënt"
                },
                "symptoms": {
                    "type": "string",
                    "description": "Beschrijving van symptomen"
                }
            },
            "required": ["reason", "urgency_level"]
        }
    },
    {
        "type": "webhook",
        "name": "request_repeat_prescription",
        "description": "Vraag een herhaalrecept aan voor een patiënt. Gebruik dit wanneer een patiënt medicijnen wil laten bijschrijven.",
        "parameters": {
            "type": "object",
            "properties": {
                "medication": {
                    "type": "string",
                    "description": "Naam van het medicijn"
                },
                "dosage": {
                    "type": "string",
                    "description": "Dosering van het medicijn"
                },
                "patient_name": {
                    "type": "string",
                    "description": "Naam van de patiënt"
                },
                "pharmacy": {
                    "type": "string",
                    "description": "Naam van de apotheek (optioneel)"
                }
            },
            "required": ["medication", "patient_name"]
        }
    },
    {
        "type": "webhook",
        "name": "schedule_callback",
        "description": "Plan een terugbelverzoek in. Gebruik dit wanneer de patiënt teruggebeld wil worden.",
        "parameters": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Naam van de patiënt"
                },
                "phone_number": {
                    "type": "string",
                    "description": "Telefoonnummer om terug te bellen"
                },
                "preferred_time": {
                    "type": "string",
                    "description": "Gewenst tijdstip voor terugbellen"
                },
                "reason": {
                    "type": "string",
                    "description": "Reden voor het terugbelverzoek"
                }
            },
            "required": ["name", "phone_number"]
        }
    },
    {
        "type": "webhook",
        "name": "leave_message",
        "description": "Laat een bericht achter voor de praktijk. Gebruik dit wanneer de patiënt een boodschap wil achterlaten.",
        "parameters": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Naam van de persoon"
                },
                "message": {
                    "type": "string",
                    "description": "Het bericht dat achtergelaten moet worden"
                },
                "callback_requested": {
                    "type": "boolean",
                    "description": "Of er teruggebeld moet worden"
                },
                "phone_number": {
                    "type": "string",
                    "description": "Telefoonnummer (als terugbellen gewenst)"
                }
            },
            "required": ["name", "message"]
        }
    }
]

# Convert tools to webhook format with api_schema
for tool in TOOLS:
    tool_url = f"{WEBHOOK_BASE_URL}/{tool['name']}"
    tool["url"] = tool_url
    # ElevenLabs webhook tools require api_schema describing the request/response
    tool["api_schema"] = {
        "url": tool_url,
        "method": "POST",
        "request_body_schema": {
            "type": "object",
            "properties": tool["parameters"]["properties"],
            "required": tool["parameters"].get("required", []),
        },
    }
    # Remove old parameters key (now in api_schema)
    del tool["parameters"]

print(f"Updating agent {AGENT_ID}...")
print(f"Webhook base URL: {WEBHOOK_BASE_URL}")

# Update the agent with tools and new system prompt
response = elevenlabs.conversational_ai.agents.update(
    agent_id=AGENT_ID,
    name="Huisartspraktijk De Gezondheid - Telefoonassistent",
    tags=["huisarts", "v3-conversational", "demo"],
    conversation_config={
        "tts": {
            "voice_id": "XJa38TJgDqYhj5mYbSJA",
            "model_id": "eleven_v3_conversational",
            "speed": 1.15,
        },
        "agent": {
            "first_message": "Goedemorgen, u spreekt met Lisa van Huisartspraktijk De Gezondheid. Waarmee kan ik u helpen?",
            "prompt": {
                "prompt": SYSTEM_PROMPT,
                "tools": TOOLS,
            },
        },
    },
)

print(f"Agent updated successfully!")
print(f"Agent ID: {response.agent_id}")
print(f"Tools configured: {len(TOOLS)}")
for tool in TOOLS:
    print(f"  - {tool['name']}: {tool['description'][:60]}...")
