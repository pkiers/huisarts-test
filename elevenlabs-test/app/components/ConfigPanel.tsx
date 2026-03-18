"use client";

import { useState, useEffect } from "react";
import { handleToolCall } from "../lib/tool-handlers";

interface Tool {
  type: string;
  name: string;
  description: string;
  url?: string;
}

const TOOL_EXAMPLES: Record<string, Record<string, unknown>> = {
  check_availability: { doctor: "Dr. Van der Berg" },
  book_appointment: { date: "2026-03-19", time: "09:00", doctor: "Dr. Van der Berg", reason: "Hoofdpijn" },
  get_patient_info: { name: "Peter Kiers", date_of_birth: "21-02-1983" },
  escalate_urgent: { reason: "Pijn op de borst", urgency_level: "critical" },
  request_repeat_prescription: { medication: "Omeprazol", dosage: "20mg", patient_name: "Peter Kiers" },
  schedule_callback: { name: "Peter Kiers", phone_number: "0611438707", preferred_time: "vanmiddag" },
  leave_message: { name: "Peter Kiers", message: "Graag terugbellen over uitslagen bloedonderzoek" },
};

// Section markers to split the prompt
const SECTIONS = [
  { key: "identity", label: "Identiteit & Rol", icon: "\u{1F464}", description: "Wie is de assistent en wat is haar rol?" },
  { key: "tone", label: "Toon & Expressie", icon: "\u{1F3A4}", description: "Hoe spreekt de assistent?" },
  { key: "tasks", label: "Kerntaken", icon: "\u{1F4CB}", description: "Wat kan de assistent doen?" },
  { key: "guidelines", label: "Gespreksrichtlijnen", icon: "\u{1F4AC}", description: "Hoe voert de assistent gesprekken?" },
  { key: "triage", label: "NTS Triage Protocol (ABCDE)", icon: "\u{1F6D1}", description: "Medische triage volgens Nederlandse Triage Standaard" },
  { key: "workflow", label: "Workflow & Afspraken", icon: "\u{1F504}", description: "Stappen in het gesprek en afspraakproces" },
  { key: "limitations", label: "Beperkingen", icon: "\u26D4", description: "Wat kan de assistent NIET?" },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

function splitPromptIntoSections(prompt: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const lines = prompt.split("\n");
  let currentKey = "identity";
  let currentLines: string[] = [];

  const sectionMap: Record<string, SectionKey> = {
    "toon en expressie": "tone",
    "kerntaken": "tasks",
    "gespreksrichtlijnen": "guidelines",
    "triage protocol": "triage",
    "workflow": "workflow",
    "belangrijk bij afspraken": "workflow",
    "belangrijk: wat je niet": "limitations",
  };

  for (const line of lines) {
    const lower = line.toLowerCase().replace(/^#+\s*/, "").trim();
    let matched = false;
    for (const [pattern, key] of Object.entries(sectionMap)) {
      if (lower.includes(pattern)) {
        // Save current section
        sections[currentKey] = currentLines.join("\n").trim();
        currentKey = key;
        currentLines = [];
        matched = true;
        break;
      }
    }
    if (!matched) {
      currentLines.push(line);
    }
  }
  sections[currentKey] = currentLines.join("\n").trim();

  // Ensure all sections exist
  for (const s of SECTIONS) {
    if (!sections[s.key]) sections[s.key] = "";
  }
  return sections;
}

function combineSections(sections: Record<string, string>): string {
  const parts: string[] = [];

  if (sections.identity) parts.push(sections.identity);
  if (sections.tone) parts.push(`## Toon en expressie\n${sections.tone}`);
  if (sections.tasks) parts.push(`## Kerntaken\n${sections.tasks}`);
  if (sections.guidelines) parts.push(`## Gespreksrichtlijnen\n${sections.guidelines}`);
  if (sections.triage) parts.push(`## Triage Protocol (NTS — Nederlandse Triage Standaard)\n${sections.triage}`);
  if (sections.workflow) parts.push(`## Workflow\n${sections.workflow}`);
  if (sections.limitations) parts.push(`## BELANGRIJK: Wat je NIET kunt\n${sections.limitations}`);

  return parts.join("\n\n");
}

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
  const [sections, setSections] = useState<Record<string, string>>({});
  const [editFirstMessage, setEditFirstMessage] = useState("");
  const [editSpeed, setEditSpeed] = useState(1.0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [expandedTool, setExpandedTool] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/agent-config")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); return; }
        setConfig(data);
        setSections(splitPromptIntoSections(data.prompt));
        setEditFirstMessage(data.firstMessage);
        setEditSpeed(data.speed);
      })
      .catch((e) => setError(String(e)));
  }, []);

  const updateSection = (key: string, value: string) => {
    setSections((prev) => ({ ...prev, [key]: value }));
  };

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const prompt = combineSections(sections);
      const res = await fetch("/api/agent-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, firstMessage: editFirstMessage, speed: editSpeed }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); }
      else { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    } catch (e) { setError(String(e)); }
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
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--foreground)]">Agent Configuratie</h3>
        <div className="flex items-center gap-3">
          {saved && <span className="text-xs text-[var(--success)] font-medium animate-fade-in">Opgeslagen</span>}
          {error && config && <span className="text-xs text-[var(--danger)] font-medium">Fout bij opslaan</span>}
          <button onClick={handleSave} disabled={saving}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm text-white font-medium hover:bg-[var(--primary-dark)] transition-colors disabled:opacity-50">
            {saving ? "Opslaan..." : "Opslaan"}
          </button>
        </div>
      </div>

      {/* First Message + Speed */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-[var(--card-border)] bg-white p-4 shadow-sm">
          <label className="block text-sm font-medium text-[var(--foreground)] mb-2">Begroeting</label>
          <input type="text" value={editFirstMessage} onChange={(e) => setEditFirstMessage(e.target.value)}
            className="w-full rounded-lg border border-[var(--card-border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent" />
        </div>
        <div className="rounded-xl border border-[var(--card-border)] bg-white p-4 shadow-sm">
          <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
            Spreeksnelheid: {editSpeed.toFixed(2)}x
          </label>
          <input type="range" min="0.8" max="1.5" step="0.05" value={editSpeed}
            onChange={(e) => setEditSpeed(parseFloat(e.target.value))} className="w-full" />
          <div className="flex justify-between text-xs text-[var(--text-muted)] mt-1">
            <span>0.8x</span><span>1.0x</span><span>1.5x</span>
          </div>
        </div>
      </div>

      {/* Prompt Sections */}
      <div>
        <h4 className="text-sm font-semibold text-[var(--foreground)] mb-3">Systeem Prompt</h4>
        <div className="space-y-3">
          {SECTIONS.map((section) => {
            const isCollapsed = collapsedSections.has(section.key);
            const value = sections[section.key] || "";
            const lineCount = value.split("\n").length;
            return (
              <div key={section.key} className="rounded-xl border border-[var(--card-border)] bg-white shadow-sm overflow-hidden">
                <button
                  onClick={() => toggleSection(section.key)}
                  className="flex items-center gap-3 w-full p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="text-lg">{section.icon}</span>
                  <div className="flex-1">
                    <span className="text-sm font-medium text-[var(--foreground)]">{section.label}</span>
                    <p className="text-xs text-[var(--text-muted)]">{section.description}</p>
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)] bg-gray-100 px-2 py-0.5 rounded-full">
                    {lineCount} regels
                  </span>
                  <svg className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${isCollapsed ? "" : "rotate-180"}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {!isCollapsed && (
                  <div className="border-t border-[var(--card-border)] p-4 pt-3">
                    <textarea
                      value={value}
                      onChange={(e) => updateSection(section.key, e.target.value)}
                      rows={Math.min(Math.max(lineCount + 1, 3), 20)}
                      className="w-full rounded-lg border border-[var(--card-border)] px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent resize-y"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Tools */}
      <div>
        <h4 className="text-sm font-semibold text-[var(--foreground)] mb-3">Tools ({config.tools.length})</h4>
        <div className="space-y-2">
          {config.tools.map((tool) => {
            const isExpanded = expandedTool === tool.name;
            const exampleInput = TOOL_EXAMPLES[tool.name] || {};
            const exampleOutput = handleToolCall(tool.name, exampleInput);
            return (
              <div key={tool.name} className="rounded-lg border border-[var(--card-border)] overflow-hidden">
                <button onClick={() => setExpandedTool(isExpanded ? null : tool.name)}
                  className="flex items-start gap-3 p-3 w-full text-left hover:bg-gray-50 transition-colors">
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
                      }`}>{tool.type}</span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">{tool.description}</p>
                    {tool.url && <p className="text-[10px] text-[var(--text-muted)] mt-1 font-mono truncate">{tool.url}</p>}
                  </div>
                  <svg className={`w-4 h-4 text-[var(--text-muted)] shrink-0 mt-1 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isExpanded && (
                  <div className="border-t border-[var(--card-border)] bg-gray-50 p-3 space-y-3 animate-fade-in">
                    <div>
                      <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1">Voorbeeld Input</p>
                      <pre className="text-xs bg-white rounded-md border border-[var(--card-border)] p-2 overflow-x-auto font-mono">
                        {JSON.stringify(exampleInput, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-[var(--success)] uppercase tracking-wide mb-1">Voorbeeld Response</p>
                      <pre className="text-xs bg-white rounded-md border border-[var(--success)] border-opacity-30 p-2 overflow-x-auto font-mono">
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
