"use client";

import { useState, useEffect } from "react";
import { handleToolCall } from "../lib/tool-handlers";

interface Tool {
  type: string;
  name: string;
  description: string;
  url?: string;
}

// Example inputs for each tool
const TOOL_EXAMPLES: Record<string, Record<string, unknown>> = {
  check_availability: { doctor: "Dr. Van der Berg" },
  book_appointment: { date: "2026-03-19", time: "09:00", doctor: "Dr. Van der Berg", reason: "Hoofdpijn" },
  get_patient_info: { name: "Peter Kiers", date_of_birth: "21-02-1983" },
  escalate_urgent: { reason: "Pijn op de borst", urgency_level: "critical" },
  request_repeat_prescription: { medication: "Omeprazol", dosage: "20mg", patient_name: "Peter Kiers" },
  schedule_callback: { name: "Peter Kiers", phone_number: "0611438707", preferred_time: "vanmiddag" },
  leave_message: { name: "Peter Kiers", message: "Graag terugbellen over uitslagen bloedonderzoek" },
};

interface AgentConfig {
  name: string;
  prompt: string;
  tools: Tool[];
  firstMessage: string;
  voiceId: string;
  speed: number;
}

export default function ConfigPanel() {
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [editFirstMessage, setEditFirstMessage] = useState("");
  const [editSpeed, setEditSpeed] = useState(1.0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [expandedTool, setExpandedTool] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/agent-config")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setConfig(data);
        setEditPrompt(data.prompt);
        setEditFirstMessage(data.firstMessage);
        setEditSpeed(data.speed);
      })
      .catch((e) => setError(String(e)));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const res = await fetch("/api/agent-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: editPrompt,
          firstMessage: editFirstMessage,
          speed: editSpeed,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (e) {
      setError(String(e));
    }
    setSaving(false);
  };

  if (error && !config) {
    return (
      <div className="rounded-2xl border border-[var(--danger)] bg-[var(--danger-light)] p-4">
        <p className="text-sm text-[var(--danger)]">{error}</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="rounded-2xl border border-[var(--card-border)] bg-white p-6 shadow-sm">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-20 bg-gray-200 rounded" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--foreground)]">
          Agent Configuratie
        </h3>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="text-xs text-[var(--success)] font-medium animate-fade-in">
              Opgeslagen
            </span>
          )}
          {error && config && (
            <span className="text-xs text-[var(--danger)] font-medium">
              Fout bij opslaan
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm text-white font-medium hover:bg-[var(--primary-dark)] transition-colors disabled:opacity-50"
          >
            {saving ? "Opslaan..." : "Opslaan"}
          </button>
        </div>
      </div>

      {/* First Message */}
      <div className="rounded-xl border border-[var(--card-border)] bg-white p-4 shadow-sm">
        <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
          Begroeting
        </label>
        <input
          type="text"
          value={editFirstMessage}
          onChange={(e) => setEditFirstMessage(e.target.value)}
          className="w-full rounded-lg border border-[var(--card-border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
        />
      </div>

      {/* Speed */}
      <div className="rounded-xl border border-[var(--card-border)] bg-white p-4 shadow-sm">
        <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
          Spreeksnelheid: {editSpeed.toFixed(2)}x
        </label>
        <input
          type="range"
          min="0.8"
          max="1.5"
          step="0.05"
          value={editSpeed}
          onChange={(e) => setEditSpeed(parseFloat(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-[var(--text-muted)] mt-1">
          <span>0.8x</span>
          <span>1.0x</span>
          <span>1.5x</span>
        </div>
      </div>

      {/* System Prompt */}
      <div className="rounded-xl border border-[var(--card-border)] bg-white p-4 shadow-sm">
        <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
          Systeem Prompt
        </label>
        <textarea
          value={editPrompt}
          onChange={(e) => setEditPrompt(e.target.value)}
          rows={15}
          className="w-full rounded-lg border border-[var(--card-border)] px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent resize-y"
        />
      </div>

      {/* Tools */}
      <div className="rounded-xl border border-[var(--card-border)] bg-white p-4 shadow-sm">
        <label className="block text-sm font-medium text-[var(--foreground)] mb-3">
          Tools ({config.tools.length})
        </label>
        <div className="space-y-2">
          {config.tools.map((tool) => {
            const isExpanded = expandedTool === tool.name;
            const exampleInput = TOOL_EXAMPLES[tool.name] || {};
            const exampleOutput = handleToolCall(tool.name, exampleInput);
            return (
              <div
                key={tool.name}
                className="rounded-lg border border-[var(--card-border)] overflow-hidden"
              >
                <button
                  onClick={() => setExpandedTool(isExpanded ? null : tool.name)}
                  className="flex items-start gap-3 p-3 w-full text-left hover:bg-gray-50 transition-colors"
                >
                  <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm ${
                    tool.type === "webhook" ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"
                  }`}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{tool.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        tool.type === "webhook" ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"
                      }`}>
                        {tool.type}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      {tool.description}
                    </p>
                    {tool.url && (
                      <p className="text-[10px] text-[var(--text-muted)] mt-1 font-mono truncate">
                        {tool.url}
                      </p>
                    )}
                  </div>
                  <svg className={`w-4 h-4 text-[var(--text-muted)] shrink-0 mt-1 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isExpanded && (
                  <div className="border-t border-[var(--card-border)] bg-gray-50 p-3 space-y-3 animate-fade-in">
                    <div>
                      <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1">
                        Voorbeeld Input
                      </p>
                      <pre className="text-xs bg-white rounded-md border border-[var(--card-border)] p-2 overflow-x-auto font-mono text-[var(--foreground)]">
                        {JSON.stringify(exampleInput, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-[var(--success)] uppercase tracking-wide mb-1">
                        Voorbeeld Response
                      </p>
                      <pre className="text-xs bg-white rounded-md border border-[var(--success)] border-opacity-30 p-2 overflow-x-auto font-mono text-[var(--foreground)]">
                        {JSON.stringify(exampleOutput, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
