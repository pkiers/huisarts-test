/**
 * Client-side tool handlers for ElevenLabs web calls.
 * Same fake data as server-side tool-handlers.ts.
 */

import type { ToolCallEvent } from "../components/ToolCards";

const PATIENTS: Record<string, Record<string, unknown>> = {
  kiers: { name: "Peter Kiers", dob: "21-02-1983", huisarts: "Dr. Van der Berg", allergies: ["Penicilline"], medications: ["Omeprazol 20mg", "Metformine 500mg"] },
  jansen: { name: "Maria Jansen", dob: "15-03-1985", huisarts: "Dr. Van der Berg", allergies: [], medications: ["Lisinopril 10mg"] },
  "de vries": { name: "Pieter de Vries", dob: "22-08-1972", huisarts: "Dr. Bakker", allergies: [], medications: ["Metformine 500mg"] },
  dijkstra: { name: "Siebrand Dijkstra", dob: "15-05-1968", huisarts: "Dr. Van der Berg", allergies: [], medications: ["Atorvastatine 40mg"] },
};

const SLOTS = [
  { date: "2026-03-19", time: "09:00", doctor: "Dr. Van der Berg" },
  { date: "2026-03-19", time: "10:30", doctor: "Dr. Bakker" },
  { date: "2026-03-19", time: "14:00", doctor: "Dr. Van der Berg" },
  { date: "2026-03-20", time: "08:30", doctor: "Dr. Bakker" },
];

export function createClientTools(
  onToolCall: (tc: ToolCallEvent) => void
): Record<string, (params: Record<string, unknown>) => Promise<string>> {
  const emit = (tool: string, args: Record<string, unknown>, result: Record<string, unknown>) => {
    onToolCall({ id: crypto.randomUUID(), tool, args, result, timestamp: new Date().toISOString() });
    return JSON.stringify(result);
  };

  return {
    check_availability: async (params) => emit("check_availability", params, { slots: SLOTS }),

    book_appointment: async (params) => emit("book_appointment", params, {
      confirmation: true, date: params.date || "morgen", time: params.time || "09:00",
      doctor: params.doctor || "Dr. Van der Berg", reason: params.reason || "Consult",
      reference: "AF-20260318-001",
    }),

    get_patient_info: async (params) => {
      const name = String(params.name || "").toLowerCase();
      const dob = String(params.date_of_birth || "");

      // Find candidates by last name
      const candidates = Object.values(PATIENTS).filter((p) => {
        const pLast = (p.name as string).split(" ").pop()!.toLowerCase();
        return name.includes(pLast) || pLast.includes(name.split(" ").pop()!.toLowerCase());
      });

      if (candidates.length > 0) {
        return emit("get_patient_info", params, {
          zoekterm: { naam: params.name, geboortedatum: dob },
          kandidaten: candidates,
          instructie: "Vergelijk de opgegeven naam en geboortedatum met de kandidaten. Accepteer alleen als achternaam EN geboortedatum overeenkomen. Als het niet klopt, vraag de beller om het te spellen of corrigeren.",
        });
      }
      return emit("get_patient_info", params, {
        zoekterm: { naam: params.name, geboortedatum: dob },
        kandidaten: [],
        instructie: "Geen patiënt gevonden met deze achternaam. De patiënt moet ingeschreven staan bij de praktijk. Vraag om de naam te spellen.",
      });
    },

    escalate_urgent: async (params) => emit("escalate_urgent", params, {
      escalated: true, reason: params.reason, urgency: params.urgency_level || "high",
      action: "Wordt direct doorverbonden met dienstdoende arts",
    }),

    request_repeat_prescription: async (params) => emit("request_repeat_prescription", params, {
      requested: true, medication: params.medication, dosage: params.dosage,
      reference: "RX-20260318-001", status: "In behandeling",
    }),

    schedule_callback: async (params) => emit("schedule_callback", params, {
      scheduled: true, name: params.name, phone: params.phone_number,
      preferred_time: params.preferred_time || "zo snel mogelijk", reference: "CB-20260318-001",
    }),

    leave_message: async (params) => emit("leave_message", params, {
      saved: true, name: params.name, message: params.message, timestamp: new Date().toISOString(),
    }),
  };
}
