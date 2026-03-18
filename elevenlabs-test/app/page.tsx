"use client";

import { useState, useCallback, useEffect } from "react";
import VoiceCall from "./components/VoiceCall";
import PhoneMonitor from "./components/PhoneMonitor";
import ConfigPanel from "./components/ConfigPanel";
import DataPanel from "./components/DataPanel";
import Transcript, { TranscriptMessage } from "./components/Transcript";
import ToolCards, { ToolCallEvent } from "./components/ToolCards";

type Mode = "idle" | "web-call" | "phone-monitor";
type Tab = "call" | "config" | "data";

export default function Home() {
  const [mode, setMode] = useState<Mode>("idle");
  const [tab, setTab] = useState<Tab>("call");
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCallEvent[]>([]);
  const [activeCall, setActiveCall] = useState<{ room: string; participants: number } | null>(null);

  // Poll for active phone calls
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/livekit-rooms");
        const data = await res.json();
        const rooms = (data.rooms || []).filter((r: { name: string; numParticipants: number }) => r.name.startsWith("huisarts-_") && r.numParticipants > 0);
        setActiveCall(rooms.length > 0 ? { room: rooms[0].name, participants: rooms[0].numParticipants } : null);
      } catch { setActiveCall(null); }
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleTranscript = useCallback((msg: TranscriptMessage) => {
    setMessages((prev) => {
      const next = [...prev, msg];
      next.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      return next;
    });
  }, []);

  const handleToolCall = useCallback((tc: ToolCallEvent) => {
    setToolCalls((prev) => {
      const next = [...prev, tc];
      next.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      return next;
    });
  }, []);

  const handleEnd = useCallback(() => {
    setMode("idle");
  }, []);

  const handleStartWebCall = () => {
    setMessages([]);
    setToolCalls([]);
    setMode("web-call");
  };

  const handleStartPhoneMonitor = () => {
    setMessages([]);
    setToolCalls([]);
    setMode("phone-monitor");
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--card-border)] bg-white">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center gap-4">
          <button onClick={() => { setTab("call"); setMode("idle"); }} className="flex items-center gap-4 hover:opacity-80 transition-opacity">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)] text-white font-bold text-lg">
              H
            </div>
            <div className="text-left">
              <h1 className="text-xl font-semibold text-[var(--foreground)]">
                Huisartspraktijk De Gezondheid
              </h1>
              <p className="text-sm text-[var(--text-muted)]">
                AI Telefoonassistent — Demo
              </p>
            </div>
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-1 rounded-full bg-gray-100 p-1">
            <button
              onClick={() => setTab("call")}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                tab === "call" ? "bg-white text-[var(--primary)] shadow-sm" : "text-[var(--text-muted)]"
              }`}
            >
              Bellen
            </button>
            <button
              onClick={() => setTab("config")}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                tab === "config" ? "bg-white text-[var(--primary)] shadow-sm" : "text-[var(--text-muted)]"
              }`}
            >
              Configuratie
            </button>
            <button
              onClick={() => setTab("data")}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                tab === "data" ? "bg-white text-[var(--primary)] shadow-sm" : "text-[var(--text-muted)]"
              }`}
            >
              Data
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {tab === "config" ? (
          <ConfigPanel />
        ) : tab === "data" ? (
          <DataPanel />
        ) : mode === "idle" ? (
          <div className="flex flex-col items-center gap-8 pt-12">
            <div className="text-center max-w-lg">
              <h2 className="text-3xl font-bold text-[var(--foreground)] mb-3">
                Welkom bij onze praktijk
              </h2>
              <p className="text-[var(--text-muted)] text-lg">
                Onze AI-assistent Lisa helpt u met afspraken, recepten en triage.
                Probeer het via de browser of bel ons telefoonnummer.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 w-full max-w-2xl">
              {/* Web Call */}
              <div className="rounded-2xl border border-[var(--card-border)] bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary-light)]">
                    <svg className="w-6 h-6 text-[var(--primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold">Via Browser</h3>
                </div>
                <p className="text-[var(--text-muted)] text-sm mb-6">
                  Spreek direct met Lisa via uw microfoon. Geen telefoon nodig.
                </p>
                <button
                  onClick={handleStartWebCall}
                  className="w-full rounded-xl bg-[var(--primary)] px-6 py-3 text-white font-medium hover:bg-[var(--primary-dark)] transition-colors"
                >
                  Bel nu
                </button>
              </div>

              {/* Phone */}
              <div className="rounded-2xl border border-[var(--card-border)] bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--success-light)]">
                    <svg className="w-6 h-6 text-[var(--success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold">Via Telefoon</h3>
                </div>
                <p className="text-[var(--text-muted)] text-sm mb-2">Bel ons op:</p>
                <p className="text-2xl font-bold text-[var(--foreground)] mb-4">058-203 8458</p>
                {activeCall && (
                  <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-[var(--success-light)] border border-[var(--success)]">
                    <div className="relative">
                      <div className="h-2.5 w-2.5 rounded-full bg-[var(--success)]" />
                      <div className="absolute inset-0 h-2.5 w-2.5 rounded-full bg-[var(--success)] animate-pulse-ring" />
                    </div>
                    <span className="text-xs font-medium text-[var(--success)]">
                      Actief gesprek ({activeCall.participants} deelnemers)
                    </span>
                  </div>
                )}
                <button
                  onClick={handleStartPhoneMonitor}
                  className={`w-full rounded-xl border-2 px-6 py-3 font-medium transition-colors ${
                    activeCall
                      ? "border-[var(--success)] text-[var(--success)] hover:bg-[var(--success-light)]"
                      : "border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary-light)]"
                  }`}
                >
                  {activeCall ? "Meekijken (live)" : "Meekijken"}
                </button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3 w-full max-w-2xl mt-4">
              {[
                { icon: "\u{1F4C5}", title: "Afspraken", desc: "Plan, wijzig of annuleer afspraken" },
                { icon: "\u{1F48A}", title: "Herhaalrecepten", desc: "Vraag medicijnen aan" },
                { icon: "\u{1F3E5}", title: "Triage", desc: "Beoordeling van uw klachten" },
              ].map((item) => (
                <div key={item.title} className="rounded-xl border border-[var(--card-border)] bg-white p-4 text-center">
                  <div className="text-2xl mb-2">{item.icon}</div>
                  <h4 className="font-medium text-sm">{item.title}</h4>
                  <p className="text-xs text-[var(--text-muted)] mt-1">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 flex flex-col gap-6">
              {mode === "web-call" && (
                <VoiceCall onTranscript={handleTranscript} onToolCall={handleToolCall} onEnd={handleEnd} />
              )}
              {mode === "phone-monitor" && (
                <PhoneMonitor onTranscript={handleTranscript} onToolCall={handleToolCall} onEnd={handleEnd} />
              )}
              <Transcript messages={messages} />
            </div>
            <div className="lg:col-span-1">
              <ToolCards toolCalls={toolCalls} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
