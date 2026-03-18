/**
 * Server-side tool handlers for ElevenLabs webhook tool calls.
 * Reads from the shared data store (editable via UI).
 */

import { findPatient, getAvailableSlots, getPatients } from "./data-store";

export function handleToolCall(
  toolName: string,
  params: Record<string, unknown>
): Record<string, unknown> {
  switch (toolName) {
    case "check_availability": {
      const doctor = params.doctor as string | undefined;
      const slots = getAvailableSlots(doctor);
      return { slots: slots.map((s) => ({ date: s.date, time: s.time, doctor: s.doctor })) };
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
      const name = String(params.name || "").toLowerCase().trim();
      const dob = String(params.date_of_birth || "").trim();
      const all = getPatients();

      // Return all patients with a match hint — let the LLM decide
      const candidates = all.filter((p) => {
        const pLast = p.name.split(" ").pop()!.toLowerCase();
        return name.includes(pLast) || pLast.includes(name.split(" ").pop()!.toLowerCase());
      });

      if (candidates.length > 0) {
        return {
          zoekterm: { naam: params.name, geboortedatum: dob },
          kandidaten: candidates.map((p) => ({
            name: p.name, dob: p.dob, huisarts: p.huisarts,
            allergies: p.allergies, medications: p.medications,
          })),
          instructie: "Vergelijk de opgegeven naam en geboortedatum met de kandidaten. Accepteer alleen als achternaam EN geboortedatum overeenkomen. Als het niet klopt, vraag de beller om het te spellen of corrigeren.",
        };
      }
      return {
        zoekterm: { naam: params.name, geboortedatum: dob },
        kandidaten: [],
        instructie: "Geen patiënt gevonden met deze achternaam. De patiënt moet ingeschreven staan bij de praktijk. Vraag om de naam te spellen.",
      };
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
