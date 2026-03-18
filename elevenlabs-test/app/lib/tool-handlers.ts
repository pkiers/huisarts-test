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
      const name = String(params.name || "");
      const patient = findPatient(name);
      if (patient) {
        return {
          found: true,
          name: patient.name,
          dob: patient.dob,
          huisarts: patient.huisarts,
          allergies: patient.allergies,
          medications: patient.medications,
        };
      }
      return {
        found: false,
        error: "Patiënt niet gevonden. Controleer de voornaam, achternaam en geboortedatum nogmaals. De patiënt moet ingeschreven staan bij de praktijk.",
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
