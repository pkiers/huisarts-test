"use client";

import { useEffect, useRef } from "react";

export interface ToolCallEvent {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  result: Record<string, unknown>;
  timestamp: string;
}

interface ToolCardsProps {
  toolCalls: ToolCallEvent[];
}

function AvailabilityCard({ tc }: { tc: ToolCallEvent }) {
  const slots = (tc.result.slots as Array<{ date: string; time: string; doctor: string }>) || [];
  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-white p-4 animate-slide-up shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{"\u{1F4C5}"}</span>
        <h4 className="font-semibold text-sm">Beschikbare tijdslots</h4>
      </div>
      <div className="space-y-2">
        {slots.map((slot, i) => (
          <div key={i} className="flex items-center justify-between rounded-lg bg-[var(--primary-light)] px-3 py-2 text-xs">
            <span className="font-medium">{slot.date}</span>
            <span>{slot.time}</span>
            <span className="text-[var(--text-muted)]">{slot.doctor}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BookingCard({ tc }: { tc: ToolCallEvent }) {
  return (
    <div className="rounded-xl border-2 border-[var(--success)] bg-[var(--success-light)] p-4 animate-slide-up shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--success)] text-white text-sm">{"\u2713"}</span>
        <h4 className="font-semibold text-sm text-[var(--success)]">Afspraak Bevestigd</h4>
      </div>
      <div className="space-y-1 text-sm">
        <p><span className="text-[var(--text-muted)]">Datum:</span> {String(tc.result.date)}</p>
        <p><span className="text-[var(--text-muted)]">Tijd:</span> {String(tc.result.time)}</p>
        <p><span className="text-[var(--text-muted)]">Arts:</span> {String(tc.result.doctor)}</p>
        <p><span className="text-[var(--text-muted)]">Reden:</span> {String(tc.result.reason)}</p>
        {tc.result.reference ? (
          <p className="text-xs text-[var(--text-muted)] mt-2">Ref: {String(tc.result.reference)}</p>
        ) : null}
      </div>
    </div>
  );
}

function PatientCard({ tc }: { tc: ToolCallEvent }) {
  // Support both old format (direct fields) and new format (kandidaten array)
  const kandidaten = tc.result.kandidaten as Array<Record<string, unknown>> | undefined;
  const zoekterm = tc.result.zoekterm as Record<string, unknown> | undefined;

  // New format: kandidaten array
  if (kandidaten !== undefined) {
    if (kandidaten.length === 0) {
      return (
        <div className="rounded-xl border border-[var(--warning)] bg-[var(--warning-light)] p-4 animate-slide-up shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-lg">{"\u26A0\uFE0F"}</span>
            <div>
              <p className="text-sm font-medium">Pati&euml;nt niet gevonden</p>
              {zoekterm && (
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Gezocht: {String(zoekterm.naam || "")} {zoekterm.geboortedatum ? `(${zoekterm.geboortedatum})` : ""}
                </p>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Show as "zoeken" — LLM decides if it's a match
    const patient = kandidaten[0];
    const allergies = (patient.allergies as string[]) || [];
    const medications = (patient.medications as string[]) || [];
    return (
      <div className="rounded-xl border border-[var(--primary)] bg-[var(--primary-light)] p-4 animate-slide-up shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary)] text-white text-sm font-bold">
            {String(patient.name || "?").charAt(0)}
          </span>
          <h4 className="font-semibold text-sm">{String(patient.name)}</h4>
        </div>
        {zoekterm && (
          <p className="text-[10px] text-[var(--text-muted)] mb-2">
            Gezocht: {String(zoekterm.naam || "")} ({String(zoekterm.geboortedatum || "")})
          </p>
        )}
        <div className="space-y-1 text-sm">
          <p><span className="text-[var(--text-muted)]">Geboortedatum:</span> {String(patient.dob)}</p>
          <p><span className="text-[var(--text-muted)]">Huisarts:</span> {String(patient.huisarts)}</p>
          {allergies.length > 0 && (
            <p><span className="text-[var(--text-muted)]">Allergie&euml;n:</span> <span className="text-[var(--danger)]">{allergies.join(", ")}</span></p>
          )}
          {medications.length > 0 && (
            <p><span className="text-[var(--text-muted)]">Medicatie:</span> {medications.join(", ")}</p>
          )}
        </div>
      </div>
    );
  }

  // Old format fallback (direct fields)
  if (tc.result.error) {
    return (
      <div className="rounded-xl border border-[var(--warning)] bg-[var(--warning-light)] p-4 animate-slide-up shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-lg">{"\u26A0\uFE0F"}</span>
          <p className="text-sm font-medium">Pati&euml;nt niet gevonden</p>
        </div>
      </div>
    );
  }
  const allergies = (tc.result.allergies as string[]) || [];
  const medications = (tc.result.medications as string[]) || [];
  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-white p-4 animate-slide-up shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary-light)] text-[var(--primary)] text-sm font-bold">
          {String(tc.result.name || "?").charAt(0)}
        </span>
        <h4 className="font-semibold text-sm">{String(tc.result.name)}</h4>
      </div>
      <div className="space-y-1 text-sm">
        <p><span className="text-[var(--text-muted)]">Geboortedatum:</span> {String(tc.result.dob)}</p>
        <p><span className="text-[var(--text-muted)]">Huisarts:</span> {String(tc.result.huisarts)}</p>
        {allergies.length > 0 && (
          <p><span className="text-[var(--text-muted)]">Allergie&euml;n:</span> <span className="text-[var(--danger)]">{allergies.join(", ")}</span></p>
        )}
        {medications.length > 0 && (
          <p><span className="text-[var(--text-muted)]">Medicatie:</span> {medications.join(", ")}</p>
        )}
      </div>
    </div>
  );
}

function UrgentCard({ tc }: { tc: ToolCallEvent }) {
  return (
    <div className="rounded-xl border-2 border-[var(--danger)] bg-[var(--danger-light)] p-4 animate-slide-up shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--danger)] text-white text-lg animate-pulse">{"\u26A0"}</span>
        <div>
          <h4 className="font-bold text-sm text-[var(--danger)]">SPOED ESCALATIE</h4>
          <p className="text-xs text-[var(--danger)]">{String(tc.result.urgency).toUpperCase()}</p>
        </div>
      </div>
      <p className="text-sm mb-2">{String(tc.result.reason)}</p>
      <div className="rounded-lg bg-[var(--danger)] text-white px-3 py-2 text-sm text-center font-medium">
        {String(tc.result.action)}
      </div>
    </div>
  );
}

function PrescriptionCard({ tc }: { tc: ToolCallEvent }) {
  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-white p-4 animate-slide-up shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{"\u{1F48A}"}</span>
        <h4 className="font-semibold text-sm">Herhaalrecept Aangevraagd</h4>
      </div>
      <div className="space-y-1 text-sm">
        <p><span className="text-[var(--text-muted)]">Medicijn:</span> {String(tc.result.medication)}</p>
        {tc.result.dosage ? <p><span className="text-[var(--text-muted)]">Dosering:</span> {String(tc.result.dosage)}</p> : null}
        <p><span className="text-[var(--text-muted)]">Status:</span> <span className="text-[var(--success)]">{String(tc.result.status)}</span></p>
        {tc.result.reference ? (
          <p className="text-xs text-[var(--text-muted)] mt-2">Ref: {String(tc.result.reference)}</p>
        ) : null}
      </div>
    </div>
  );
}

function TransferCard({ tc }: { tc: ToolCallEvent }) {
  return (
    <div className="rounded-xl border border-[var(--primary)] bg-[var(--primary-light)] p-4 animate-slide-up shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{"\u{1F464}"}</span>
        <h4 className="font-semibold text-sm text-[var(--primary)]">Doorverbinden</h4>
      </div>
      <p className="text-sm mb-2">Afdeling: <span className="font-medium">{String(tc.result.department)}</span></p>
      <div className="flex items-center gap-2 text-sm text-[var(--primary)]">
        <div className="h-2 w-2 rounded-full bg-[var(--primary)] animate-pulse" />
        {String(tc.result.status)}
      </div>
    </div>
  );
}

function CallbackCard({ tc }: { tc: ToolCallEvent }) {
  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-white p-4 animate-slide-up shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{"\u{1F4DE}"}</span>
        <h4 className="font-semibold text-sm">Terugbelverzoek</h4>
      </div>
      <div className="space-y-1 text-sm">
        <p><span className="text-[var(--text-muted)]">Naam:</span> {String(tc.result.name)}</p>
        <p><span className="text-[var(--text-muted)]">Telefoon:</span> {String(tc.result.phone)}</p>
        <p><span className="text-[var(--text-muted)]">Tijdstip:</span> {String(tc.result.preferred_time)}</p>
        {tc.result.reference ? (
          <p className="text-xs text-[var(--text-muted)] mt-2">Ref: {String(tc.result.reference)}</p>
        ) : null}
      </div>
    </div>
  );
}

function MessageCard({ tc }: { tc: ToolCallEvent }) {
  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-white p-4 animate-slide-up shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--success-light)] text-[var(--success)] text-sm">{"\u2709"}</span>
        <h4 className="font-semibold text-sm">Bericht Opgeslagen</h4>
      </div>
      <div className="space-y-1 text-sm">
        <p><span className="text-[var(--text-muted)]">Van:</span> {String(tc.result.name)}</p>
        <p className="italic text-[var(--text-muted)]">&quot;{String(tc.result.message)}&quot;</p>
        <p className="text-xs text-[var(--text-muted)] mt-2">
          {new Date(String(tc.result.timestamp)).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}

const CARD_MAP: Record<string, React.ComponentType<{ tc: ToolCallEvent }>> = {
  check_availability: AvailabilityCard,
  book_appointment: BookingCard,
  get_patient_info: PatientCard,
  escalate_urgent: UrgentCard,
  request_repeat_prescription: PrescriptionCard,
  transfer_to_staff: TransferCard,
  schedule_callback: CallbackCard,
  leave_message: MessageCard,
};

export default function ToolCards({ toolCalls }: ToolCardsProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [toolCalls]);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-[var(--foreground)] px-1">Acties</h3>
      {toolCalls.length === 0 && (
        <div className="rounded-xl border border-dashed border-[var(--card-border)] p-6 text-center">
          <p className="text-sm text-[var(--text-muted)]">
            Acties verschijnen hier wanneer Lisa tools gebruikt...
          </p>
        </div>
      )}
      {toolCalls.map((tc) => {
        const CardComponent = CARD_MAP[tc.tool];
        if (!CardComponent) return null;
        return <CardComponent key={tc.id} tc={tc} />;
      })}
      <div ref={bottomRef} />
    </div>
  );
}
