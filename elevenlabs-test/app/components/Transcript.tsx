"use client";

import { useEffect, useRef } from "react";

export interface TranscriptMessage {
  id: string;
  role: "user" | "agent";
  text: string;
  timestamp: string;
}

interface TranscriptProps {
  messages: TranscriptMessage[];
}

export default function Transcript({ messages }: TranscriptProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    // Consider "near bottom" if within 80px of the bottom
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  useEffect(() => {
    if (isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-white shadow-sm flex flex-col" style={{ minHeight: "300px", maxHeight: "500px" }}>
      <div className="px-4 py-3 border-b border-[var(--card-border)]">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">Transcript</h3>
      </div>
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-sm text-[var(--text-muted)] py-8">
            Het gesprek begint zodra de verbinding is gemaakt...
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex animate-slide-up ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                msg.role === "user"
                  ? "bg-[var(--success)] text-white rounded-br-md"
                  : "bg-[var(--primary-light)] text-[var(--foreground)] rounded-bl-md"
              }`}
            >
              <p>{msg.text}</p>
              <p className={`text-[10px] mt-1 ${
                msg.role === "user" ? "text-green-200" : "text-[var(--text-muted)]"
              }`}>
                {new Date(msg.timestamp).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
