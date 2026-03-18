/**
 * Server-side tool handlers for ElevenLabs webhook tool calls.
 * Shared fake demo data — same as client-side tools but without UI callbacks.
 */

const PATIENTS: Record<string, Record<string, unknown>> = {
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
  dijkstra: {
    name: "Siebrand Dijkstra",
    dob: "15-05-1968",
    huisarts: "Dr. Van der Berg",
    allergies: [],
    medications: ["Atorvastatine 40mg"],
  },
};

const SLOTS = [
  { date: "2026-03-19", time: "09:00", doctor: "Dr. Van der Berg" },
  { date: "2026-03-19", time: "10:30", doctor: "Dr. Bakker" },
  { date: "2026-03-19", time: "14:00", doctor: "Dr. Van der Berg" },
  { date: "2026-03-20", time: "08:30", doctor: "Dr. Bakker" },
];

export function handleToolCall(
  toolName: string,
  params: Record<string, unknown>
): Record<string, unknown> {
  switch (toolName) {
    case "check_availability": {
      return { slots: SLOTS };
    }

    case "book_appointment": {
      return {
        confirmation: true,
        date: params.date || "morgen",
        time: params.time || "09:00",
        doctor: params.doctor || "Dr. Van der Berg",
        reason: params.reason || "Consult",
        reference: `AF-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-001`,
      };
    }

    case "get_patient_info": {
      const name = String(params.name || "").toLowerCase();
      const patient =
        Object.entries(PATIENTS).find(([key]) => name.includes(key))?.[1] ||
        PATIENTS["kiers"];
      return patient;
    }

    case "escalate_urgent": {
      return {
        escalated: true,
        reason: params.reason,
        urgency: params.urgency_level || "high",
        action: "Wordt direct doorverbonden met dienstdoende arts",
      };
    }

    case "request_repeat_prescription": {
      return {
        requested: true,
        medication: params.medication,
        dosage: params.dosage,
        reference: `RX-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-001`,
        status: "In behandeling - ophalen over 24 uur bij apotheek",
      };
    }

    case "schedule_callback": {
      return {
        scheduled: true,
        name: params.name,
        phone: params.phone_number,
        preferred_time: params.preferred_time || "zo snel mogelijk",
        reference: `CB-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-001`,
      };
    }

    case "leave_message": {
      return {
        saved: true,
        name: params.name,
        message: params.message,
        timestamp: new Date().toISOString(),
      };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}
