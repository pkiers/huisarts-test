"use client";

import { useState, useEffect } from "react";
import type { Patient, Doctor, TimeSlot } from "../lib/data-store";

type DataTab = "patients" | "doctors" | "slots";

export default function DataPanel() {
  const [tab, setTab] = useState<DataTab>("patients");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/data").then((r) => r.json()).then((data) => {
      setPatients(data.patients || []);
      setDoctors(data.doctors || []);
      setSlots(data.slots || []);
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await fetch("/api/data", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patients, doctors, slots }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const tabs: { key: DataTab; label: string; icon: string; count: number }[] = [
    { key: "patients", label: "Patiënten", icon: "\u{1F464}", count: patients.length },
    { key: "doctors", label: "Artsen", icon: "\u{1FA7A}", count: doctors.length },
    { key: "slots", label: "Agenda", icon: "\u{1F4C5}", count: slots.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--foreground)]">Data Beheer</h3>
        <div className="flex items-center gap-3">
          {saved && <span className="text-xs text-[var(--success)] font-medium animate-fade-in">Opgeslagen</span>}
          <button onClick={handleSave} disabled={saving}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm text-white font-medium hover:bg-[var(--primary-dark)] transition-colors disabled:opacity-50">
            {saving ? "Opslaan..." : "Opslaan"}
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? "bg-[var(--primary)] text-white" : "bg-white border border-[var(--card-border)] text-[var(--text-muted)] hover:bg-gray-50"
            }`}>
            <span>{t.icon}</span>
            <span>{t.label}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              tab === t.key ? "bg-white/20 text-white" : "bg-gray-100"
            }`}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === "patients" && (
        <PatientsEditor patients={patients} onChange={setPatients} />
      )}
      {tab === "doctors" && (
        <DoctorsEditor doctors={doctors} onChange={setDoctors} />
      )}
      {tab === "slots" && (
        <SlotsEditor slots={slots} doctors={doctors} onChange={setSlots} />
      )}
    </div>
  );
}

// --- Patients ---

function PatientsEditor({ patients, onChange }: { patients: Patient[]; onChange: (p: Patient[]) => void }) {
  const update = (id: string, field: keyof Patient, value: unknown) => {
    onChange(patients.map((p) => p.id === id ? { ...p, [field]: value } : p));
  };

  const add = () => {
    onChange([...patients, {
      id: String(Date.now()),
      name: "",
      dob: "",
      huisarts: "Dr. Van der Berg",
      allergies: [],
      medications: [],
    }]);
  };

  const remove = (id: string) => {
    onChange(patients.filter((p) => p.id !== id));
  };

  return (
    <div className="space-y-3">
      {patients.map((p) => (
        <div key={p.id} className="rounded-xl border border-[var(--card-border)] bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-[10px] font-semibold text-[var(--text-muted)] uppercase">Naam</label>
              <input type="text" value={p.name} onChange={(e) => update(p.id, "name", e.target.value)}
                className="w-full mt-1 rounded-lg border border-[var(--card-border)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-[var(--text-muted)] uppercase">Geboortedatum</label>
              <input type="text" value={p.dob} onChange={(e) => update(p.id, "dob", e.target.value)} placeholder="DD-MM-JJJJ"
                className="w-full mt-1 rounded-lg border border-[var(--card-border)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-[var(--text-muted)] uppercase">Huisarts</label>
              <input type="text" value={p.huisarts} onChange={(e) => update(p.id, "huisarts", e.target.value)}
                className="w-full mt-1 rounded-lg border border-[var(--card-border)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-[var(--text-muted)] uppercase">Allergieën (comma-gescheiden)</label>
              <input type="text" value={p.allergies.join(", ")}
                onChange={(e) => update(p.id, "allergies", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                className="w-full mt-1 rounded-lg border border-[var(--card-border)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" />
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] font-semibold text-[var(--text-muted)] uppercase">Medicatie (comma-gescheiden)</label>
              <input type="text" value={p.medications.join(", ")}
                onChange={(e) => update(p.id, "medications", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                className="w-full mt-1 rounded-lg border border-[var(--card-border)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" />
            </div>
          </div>
          <button onClick={() => remove(p.id)}
            className="mt-3 text-xs text-[var(--danger)] hover:underline">
            Verwijderen
          </button>
        </div>
      ))}
      <button onClick={add}
        className="w-full rounded-xl border-2 border-dashed border-[var(--card-border)] p-3 text-sm text-[var(--text-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors">
        + Patiënt toevoegen
      </button>
    </div>
  );
}

// --- Doctors ---

function DoctorsEditor({ doctors, onChange }: { doctors: Doctor[]; onChange: (d: Doctor[]) => void }) {
  const update = (id: string, field: keyof Doctor, value: string) => {
    onChange(doctors.map((d) => d.id === id ? { ...d, [field]: value } : d));
  };

  const add = () => {
    onChange([...doctors, { id: String(Date.now()), name: "", specialty: "Huisarts" }]);
  };

  const remove = (id: string) => {
    onChange(doctors.filter((d) => d.id !== id));
  };

  return (
    <div className="space-y-3">
      {doctors.map((d) => (
        <div key={d.id} className="rounded-xl border border-[var(--card-border)] bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-[10px] font-semibold text-[var(--text-muted)] uppercase">Naam</label>
              <input type="text" value={d.name} onChange={(e) => update(d.id, "name", e.target.value)}
                className="w-full mt-1 rounded-lg border border-[var(--card-border)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-[var(--text-muted)] uppercase">Specialisme</label>
              <input type="text" value={d.specialty} onChange={(e) => update(d.id, "specialty", e.target.value)}
                className="w-full mt-1 rounded-lg border border-[var(--card-border)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" />
            </div>
          </div>
          <button onClick={() => remove(d.id)}
            className="mt-3 text-xs text-[var(--danger)] hover:underline">
            Verwijderen
          </button>
        </div>
      ))}
      <button onClick={add}
        className="w-full rounded-xl border-2 border-dashed border-[var(--card-border)] p-3 text-sm text-[var(--text-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors">
        + Arts toevoegen
      </button>
    </div>
  );
}

// --- Slots ---

function SlotsEditor({ slots, doctors, onChange }: { slots: TimeSlot[]; doctors: Doctor[]; onChange: (s: TimeSlot[]) => void }) {
  const update = (id: string, field: keyof TimeSlot, value: unknown) => {
    onChange(slots.map((s) => s.id === id ? { ...s, [field]: value } : s));
  };

  const add = () => {
    onChange([...slots, {
      id: String(Date.now()),
      date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      time: "09:00",
      doctor: doctors[0]?.name || "Dr. Van der Berg",
      available: true,
    }]);
  };

  const remove = (id: string) => {
    onChange(slots.filter((s) => s.id !== id));
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[var(--card-border)] bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-[var(--card-border)]">
              <th className="text-left px-4 py-2 text-[10px] font-semibold text-[var(--text-muted)] uppercase">Datum</th>
              <th className="text-left px-4 py-2 text-[10px] font-semibold text-[var(--text-muted)] uppercase">Tijd</th>
              <th className="text-left px-4 py-2 text-[10px] font-semibold text-[var(--text-muted)] uppercase">Arts</th>
              <th className="text-center px-4 py-2 text-[10px] font-semibold text-[var(--text-muted)] uppercase">Beschikbaar</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {slots.map((s) => (
              <tr key={s.id} className="border-b border-[var(--card-border)] last:border-0">
                <td className="px-4 py-2">
                  <input type="date" value={s.date} onChange={(e) => update(s.id, "date", e.target.value)}
                    className="rounded border border-[var(--card-border)] px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" />
                </td>
                <td className="px-4 py-2">
                  <input type="time" value={s.time} onChange={(e) => update(s.id, "time", e.target.value)}
                    className="rounded border border-[var(--card-border)] px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" />
                </td>
                <td className="px-4 py-2">
                  <select value={s.doctor} onChange={(e) => update(s.id, "doctor", e.target.value)}
                    className="rounded border border-[var(--card-border)] px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]">
                    {doctors.map((d) => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2 text-center">
                  <button onClick={() => update(s.id, "available", !s.available)}
                    className={`h-6 w-6 rounded-full border-2 transition-colors ${
                      s.available ? "bg-[var(--success)] border-[var(--success)]" : "bg-gray-200 border-gray-300"
                    }`}>
                    {s.available && (
                      <svg className="w-4 h-4 text-white mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                </td>
                <td className="px-2 py-2">
                  <button onClick={() => remove(s.id)} className="text-[var(--danger)] hover:bg-[var(--danger-light)] rounded p-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={add}
        className="w-full rounded-xl border-2 border-dashed border-[var(--card-border)] p-3 text-sm text-[var(--text-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors">
        + Tijdslot toevoegen
      </button>
    </div>
  );
}
