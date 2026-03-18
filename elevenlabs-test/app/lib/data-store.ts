/**
 * In-memory data store for demo data.
 * Shared between tool handlers and the data API.
 * Editable via the UI — changes take effect immediately on next tool call.
 */

export interface Patient {
  id: string;
  name: string;
  dob: string;
  huisarts: string;
  allergies: string[];
  medications: string[];
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
}

export interface TimeSlot {
  id: string;
  date: string;
  time: string;
  doctor: string;
  available: boolean;
}

// --- Default data ---

const defaultPatients: Patient[] = [
  { id: "1", name: "Peter Kiers", dob: "21-02-1983", huisarts: "Dr. Van der Berg", allergies: ["Penicilline"], medications: ["Omeprazol 20mg", "Metformine 500mg"] },
  { id: "2", name: "Maria Jansen", dob: "15-03-1985", huisarts: "Dr. Van der Berg", allergies: [], medications: ["Lisinopril 10mg"] },
  { id: "3", name: "Pieter de Vries", dob: "22-08-1972", huisarts: "Dr. Bakker", allergies: [], medications: ["Metformine 500mg"] },
  { id: "4", name: "Siebrand Dijkstra", dob: "15-05-1968", huisarts: "Dr. Van der Berg", allergies: [], medications: ["Atorvastatine 40mg"] },
];

const defaultDoctors: Doctor[] = [
  { id: "1", name: "Dr. Van der Berg", specialty: "Huisarts" },
  { id: "2", name: "Dr. Bakker", specialty: "Huisarts" },
  { id: "3", name: "Dr. De Jong", specialty: "Praktijkondersteuner" },
];

const defaultSlots: TimeSlot[] = [
  { id: "1", date: "2026-03-19", time: "09:00", doctor: "Dr. Van der Berg", available: true },
  { id: "2", date: "2026-03-19", time: "10:30", doctor: "Dr. Bakker", available: true },
  { id: "3", date: "2026-03-19", time: "14:00", doctor: "Dr. Van der Berg", available: true },
  { id: "4", date: "2026-03-20", time: "08:30", doctor: "Dr. Bakker", available: true },
  { id: "5", date: "2026-03-20", time: "11:00", doctor: "Dr. Van der Berg", available: true },
  { id: "6", date: "2026-03-20", time: "14:30", doctor: "Dr. De Jong", available: true },
];

// --- Mutable store ---

let patients = [...defaultPatients];
let doctors = [...defaultDoctors];
let slots = [...defaultSlots];

export function getPatients(): Patient[] { return patients; }
export function getDoctors(): Doctor[] { return doctors; }
export function getSlots(): TimeSlot[] { return slots; }

export function setPatients(data: Patient[]) { patients = data; }
export function setDoctors(data: Doctor[]) { doctors = data; }
export function setSlots(data: TimeSlot[]) { slots = data; }

// --- Lookup helpers (used by tool handlers) ---

export function findPatient(name: string): Patient | undefined {
  const lower = name.toLowerCase();
  return patients.find((p) =>
    p.name.toLowerCase().includes(lower) ||
    lower.includes(p.name.split(" ").pop()!.toLowerCase())
  );
}

export function getAvailableSlots(doctor?: string): TimeSlot[] {
  return slots
    .filter((s) => s.available && (!doctor || s.doctor.toLowerCase().includes(doctor.toLowerCase())))
    .slice(0, 6);
}
