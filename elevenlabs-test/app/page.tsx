"use client";

import { useState, useCallback, useEffect } from "react";
import ElevenLabsCall from "./components/ElevenLabsCall";
import GeminiCall from "./components/GeminiCall";
import PhoneMonitor from "./components/PhoneMonitor";
import Transcript, { TranscriptMessage } from "./components/Transcript";
import ToolCards, { ToolCallEvent } from "./components/ToolCards";
import type { Provider } from "./lib/types";

type Mode = "idle" | "web-call" | "phone-monitor";

export default function Home() {
  const [mode, setMode] = useState<Mode>("idle");
  const [provider, setProvider] = useState<Provider>("elevenlabs");
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCallEvent[]>([]);
  const [activeCall, setActiveCall] = useState<{ room: string; participants: number } | null>(null);

  // Load saved provider on mount + poll for active calls
  useEffect(() => {
    fetch("/api/provider").then(r => r.json()).then(d => {
      if (d.provider) setProvider(d.provider);
    }).catch(() => {});

    const pollRooms = async () => {
      try {
        const res = await fetch("/api/livekit-rooms");
        const data = await res.json();
        const rooms = (data.rooms || []).filter((r: { name: string }) => r.name.startsWith("huisarts-_"));
        if (rooms.length > 0) {
          setActiveCall({ room: rooms[0].name, participants: rooms[0].numParticipants });
        } else {
          setActiveCall(null);
        }
      } catch { setActiveCall(null); }
    };

    pollRooms();
    const interval = setInterval(pollRooms, 3000);
    return () => clearInterval(interval);
  }, []);

  // Sync provider toggle to server (so phone agent uses the same)
  const handleProviderChange = (p: Provider) => {
    setProvider(p);
    fetch("/api/provider", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: p }),
    }).catch(() => {});
  };

  const handleTranscript = useCallback((msg: TranscriptMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const handleToolCall = useCallback((tc: ToolCallEvent) => {
    setToolCalls((prev) => [...prev, tc]);
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
      {/* Header */}
      <header className="border-b border-[var(--card-border)] bg-white">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)] text-white font-bold text-lg">
            H
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-[var(--foreground)]">
              Huisartspraktijk De Gezondheid
            </h1>
            <p className="text-sm text-[var(--text-muted)]">
              AI Telefoonassistent — Demo
            </p>
          </div>
          {mode !== "idle" && (
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-medium px-3 py-1 rounded-full ${
                  provider === "elevenlabs"
                    ? "bg-[var(--primary-light)] text-[var(--primary)]"
                    : "bg-blue-100 text-blue-700"
                }`}
              >
                {provider === "elevenlabs" ? "ElevenLabs" : "Gemini"}
              </span>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {mode === "idle" ? (
          /* Landing */
          <div className="flex flex-col items-center gap-8 pt-12">
            <div className="text-center max-w-lg">
              <h2 className="text-3xl font-bold text-[var(--foreground)] mb-3">
                Welkom bij onze praktijk
              </h2>
              <p className="text-[var(--text-muted)] text-lg">
                Onze AI-assistent Lisa helpt u met afspraken, recepten en
                triage. Probeer het via de browser of bel ons telefoonnummer.
              </p>
            </div>

            {/* Provider Toggle */}
            <div className="flex items-center gap-1 rounded-full bg-gray-100 p-1">
              <button
                onClick={() => handleProviderChange("elevenlabs")}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
                  provider === "elevenlabs"
                    ? "bg-white text-[var(--primary)] shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--foreground)]"
                }`}
              >
                ElevenLabs
              </button>
              <button
                onClick={() => handleProviderChange("gemini")}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
                  provider === "gemini"
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--foreground)]"
                }`}
              >
                Gemini
              </button>
            </div>

            <div className="grid gap-6 md:grid-cols-2 w-full max-w-2xl">
              {/* Web Call Card */}
              <div className="rounded-2xl border border-[var(--card-border)] bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary-light)]">
                    <svg
                      className="w-6 h-6 text-[var(--primary)]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold">Via Browser</h3>
                </div>
                <p className="text-[var(--text-muted)] text-sm mb-6">
                  Spreek direct met Lisa via uw microfoon. Geen telefoon nodig.
                </p>
                <button
                  onClick={handleStartWebCall}
                  className={`w-full rounded-xl px-6 py-3 text-white font-medium transition-colors ${
                    provider === "elevenlabs"
                      ? "bg-[var(--primary)] hover:bg-[var(--primary-dark)]"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  Bel nu via {provider === "elevenlabs" ? "ElevenLabs" : "Gemini"}
                </button>
              </div>

              {/* Phone Card */}
              <div className="rounded-2xl border border-[var(--card-border)] bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--success-light)]">
                    <svg
                      className="w-6 h-6 text-[var(--success)]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold">Via Telefoon</h3>
                </div>
                <p className="text-[var(--text-muted)] text-sm mb-2">
                  Bel ons op:
                </p>
                <p className="text-2xl font-bold text-[var(--foreground)] mb-4">
                  058-203 8458
                </p>
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

            {/* Info cards */}
            <div className="grid gap-4 md:grid-cols-3 w-full max-w-2xl mt-4">
              {[
                {
                  icon: "\u{1F4C5}",
                  title: "Afspraken",
                  desc: "Plan, wijzig of annuleer afspraken",
                },
                {
                  icon: "\u{1F48A}",
                  title: "Herhaalrecepten",
                  desc: "Vraag medicijnen aan",
                },
                {
                  icon: "\u{1F3E5}",
                  title: "Triage",
                  desc: "Beoordeling van uw klachten",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-[var(--card-border)] bg-white p-4 text-center"
                >
                  <div className="text-2xl mb-2">{item.icon}</div>
                  <h4 className="font-medium text-sm">{item.title}</h4>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Active Call View */
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left: Call + Transcript */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              {mode === "web-call" && provider === "elevenlabs" && (
                <ElevenLabsCall
                  onTranscript={handleTranscript}
                  onToolCall={handleToolCall}
                  onEnd={handleEnd}
                />
              )}
              {mode === "web-call" && provider === "gemini" && (
                <GeminiCall
                  onTranscript={handleTranscript}
                  onToolCall={handleToolCall}
                  onEnd={handleEnd}
                />
              )}
              {mode === "phone-monitor" && (
                <PhoneMonitor
                  provider={provider}
                  onTranscript={handleTranscript}
                  onToolCall={handleToolCall}
                  onEnd={handleEnd}
                />
              )}
              <Transcript messages={messages} />
            </div>

            {/* Right: Tool Cards */}
            <div className="lg:col-span-1">
              <ToolCards toolCalls={toolCalls} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
