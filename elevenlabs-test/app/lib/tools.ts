import type { ToolCallEvent } from "../components/ToolCards";

export function createClientTools(
  onToolCall: (tc: ToolCallEvent) => void
): Record<string, (params: Record<string, unknown>) => Promise<string>> {
  return {
    check_availability: async (params: Record<string, unknown>) => {
      const slots = [
        { date: "2026-03-19", time: "09:00", doctor: "Dr. Van der Berg" },
        { date: "2026-03-19", time: "10:30", doctor: "Dr. Bakker" },
        { date: "2026-03-19", time: "14:00", doctor: "Dr. Van der Berg" },
        { date: "2026-03-20", time: "08:30", doctor: "Dr. Bakker" },
      ];
      const result = { slots };
      onToolCall({
        id: crypto.randomUUID(),
        tool: "check_availability",
        args: params,
        result,
        timestamp: new Date().toISOString(),
      });
      return JSON.stringify(result);
    },

    book_appointment: async (params: Record<string, unknown>) => {
      const result = {
        confirmation: true,
        date: params.date || "morgen",
        time: params.time || "09:00",
        doctor: params.doctor || "Dr. Van der Berg",
        reason: params.reason || "Consult",
        reference: "AF-20260318-001",
      };
      onToolCall({
        id: crypto.randomUUID(),
        tool: "book_appointment",
        args: params,
        result,
        timestamp: new Date().toISOString(),
      });
      return JSON.stringify(result);
    },

    get_patient_info: async (params: Record<string, unknown>) => {
      const patients: Record<string, Record<string, unknown>> = {
        kiers: {
          name: "Peter Kiers",
          dob: "21-02-1983",
          huisarts: "Dr. Van der Berg",
          allergies: ["Penicilline"],
          medications: ["Omeprazol 20mg", "Metformine 500mg"],
        },
        jansen: {
          name: "Maria Jansen",
          dob: "15-03-1985",
          huisarts: "Dr. Van der Berg",
          allergies: [],
          medications: ["Lisinopril 10mg"],
        },
        "de vries": {
          name: "Pieter de Vries",
          dob: "22-08-1972",
          huisarts: "Dr. Bakker",
          allergies: [],
          medications: ["Metformine 500mg"],
        },
      };
      const name = String(params.name || "").toLowerCase();
      const patient =
        Object.entries(patients).find(([key]) => name.includes(key))?.[1] ||
        patients["kiers"];
      onToolCall({
        id: crypto.randomUUID(),
        tool: "get_patient_info",
        args: params,
        result: patient,
        timestamp: new Date().toISOString(),
      });
      return JSON.stringify(patient);
    },

    escalate_urgent: async (params: Record<string, unknown>) => {
      const result = {
        escalated: true,
        reason: params.reason,
        urgency: params.urgency_level || "high",
        action: "Wordt direct doorverbonden met dienstdoende arts",
      };
      onToolCall({
        id: crypto.randomUUID(),
        tool: "escalate_urgent",
        args: params,
        result,
        timestamp: new Date().toISOString(),
      });
      return JSON.stringify(result);
    },

    request_repeat_prescription: async (params: Record<string, unknown>) => {
      const result = {
        requested: true,
        medication: params.medication,
        dosage: params.dosage,
        reference: "RX-20260318-001",
        status: "In behandeling",
      };
      onToolCall({
        id: crypto.randomUUID(),
        tool: "request_repeat_prescription",
        args: params,
        result,
        timestamp: new Date().toISOString(),
      });
      return JSON.stringify(result);
    },

    transfer_to_staff: async (params: Record<string, unknown>) => {
      const result = {
        transferring: true,
        department: params.department || "receptie",
        status: "Wordt doorverbonden...",
      };
      onToolCall({
        id: crypto.randomUUID(),
        tool: "transfer_to_staff",
        args: params,
        result,
        timestamp: new Date().toISOString(),
      });
      return JSON.stringify(result);
    },

    schedule_callback: async (params: Record<string, unknown>) => {
      const result = {
        scheduled: true,
        name: params.name,
        phone: params.phone_number,
        preferred_time: params.preferred_time || "zo snel mogelijk",
        reference: "CB-20260318-001",
      };
      onToolCall({
        id: crypto.randomUUID(),
        tool: "schedule_callback",
        args: params,
        result,
        timestamp: new Date().toISOString(),
      });
      return JSON.stringify(result);
    },

    leave_message: async (params: Record<string, unknown>) => {
      const result = {
        saved: true,
        name: params.name,
        message: params.message,
        timestamp: new Date().toISOString(),
      };
      onToolCall({
        id: crypto.randomUUID(),
        tool: "leave_message",
        args: params,
        result,
        timestamp: new Date().toISOString(),
      });
      return JSON.stringify(result);
    },
  };
}

/**
 * Gemini tool declarations in Google function_declarations format.
 * Mirrors the same 7 tools above for use in the Gemini Live setup message.
 */
export const geminiToolDeclarations = [
  {
    function_declarations: [
      {
        name: "check_availability",
        description:
          "Check beschikbare tijdslots bij de huisartsenpraktijk voor een afspraak.",
        parameters: {
          type: "object",
          properties: {
            preferred_date: {
              type: "string",
              description: "Gewenste datum (bijv. 2026-03-19)",
            },
            preferred_time: {
              type: "string",
              description: "Gewenst tijdstip (bijv. ochtend, middag)",
            },
            doctor: {
              type: "string",
              description: "Voorkeur arts (optioneel)",
            },
          },
          required: [],
        },
      },
      {
        name: "book_appointment",
        description: "Boek een afspraak bij de huisartsenpraktijk.",
        parameters: {
          type: "object",
          properties: {
            date: { type: "string", description: "Datum van de afspraak" },
            time: { type: "string", description: "Tijd van de afspraak" },
            doctor: { type: "string", description: "Naam van de arts" },
            reason: { type: "string", description: "Reden van de afspraak" },
          },
          required: ["date", "time"],
        },
      },
      {
        name: "get_patient_info",
        description:
          "Zoek patientgegevens op basis van naam of geboortedatum.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string", description: "Naam van de patient" },
            dob: {
              type: "string",
              description: "Geboortedatum van de patient",
            },
          },
          required: ["name"],
        },
      },
      {
        name: "escalate_urgent",
        description:
          "Escaleer een urgent medisch geval naar de dienstdoende arts.",
        parameters: {
          type: "object",
          properties: {
            reason: { type: "string", description: "Reden van de escalatie" },
            urgency_level: {
              type: "string",
              description: "Urgentieniveau: low, medium, high, critical",
            },
          },
          required: ["reason"],
        },
      },
      {
        name: "request_repeat_prescription",
        description: "Vraag een herhaalrecept aan voor een patient.",
        parameters: {
          type: "object",
          properties: {
            medication: { type: "string", description: "Naam van het medicijn" },
            dosage: { type: "string", description: "Dosering" },
          },
          required: ["medication"],
        },
      },
      {
        name: "transfer_to_staff",
        description:
          "Verbind de beller door naar een medewerker of afdeling.",
        parameters: {
          type: "object",
          properties: {
            department: {
              type: "string",
              description: "Afdeling (bijv. receptie, huisarts, spoed)",
            },
            reason: {
              type: "string",
              description: "Reden van doorverbinden",
            },
          },
          required: [],
        },
      },
      {
        name: "schedule_callback",
        description: "Plan een terugbelverzoek in voor de patient.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string", description: "Naam van de patient" },
            phone_number: { type: "string", description: "Telefoonnummer" },
            preferred_time: {
              type: "string",
              description: "Gewenst tijdstip voor terugbellen",
            },
          },
          required: ["name", "phone_number"],
        },
      },
      {
        name: "leave_message",
        description: "Sla een bericht op van de beller.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string", description: "Naam van de beller" },
            message: { type: "string", description: "Het bericht" },
          },
          required: ["name", "message"],
        },
      },
    ],
  },
];
