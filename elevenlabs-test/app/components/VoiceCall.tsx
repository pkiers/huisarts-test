"use client";

import { useState, useEffect, useRef } from "react";
import { useConversation } from "@elevenlabs/react";
import { createClientTools } from "../lib/tools";
import type { TranscriptMessage } from "./Transcript";
import type { ToolCallEvent } from "./ToolCards";

interface VoiceCallProps {
  onTranscript: (msg: TranscriptMessage) => void;
  onToolCall: (tc: ToolCallEvent) => void;
  onEnd: () => void;
}

export default function VoiceCall({ onTranscript, onToolCall, onEnd }: VoiceCallProps) {
  const [isMuted, setIsMuted] = useState(false);
  const clientToolsRef = useRef(createClientTools(onToolCall));

  const callStart = useRef(0);

  const conversation = useConversation({
    onConnect: () => {
      console.log(`[${new Date().toISOString()}] [ElevenLabs] Connected (${Date.now() - callStart.current}ms since start)`);
    },
    onDisconnect: (details) => {
      console.log("[ElevenLabs] Disconnected:", details);
      onEnd();
    },
    onMessage: (message) => {
      console.log(`[${new Date().toISOString()}] [ElevenLabs] Message: role=${message.role} len=${message.message.length} "${message.message.slice(0, 80)}"`);
      onTranscript({
        id: crypto.randomUUID(),
        role: message.role === "user" ? "user" : "agent",
        text: message.message,
        timestamp: new Date().toISOString(),
      });
    },
    onModeChange: (mode) => {
      console.log(`[${new Date().toISOString()}] [ElevenLabs] Mode: ${mode.mode}`);
    },
    onStatusChange: (status) => {
      console.log(`[${new Date().toISOString()}] [ElevenLabs] Status: ${status.status}`);
    },
    onError: (message, context) => {
      console.error(`[${new Date().toISOString()}] [ElevenLabs] Error: ${message}`, context);
    },
  });

  const status = conversation.status === "connected" ? "connected"
    : conversation.status === "connecting" ? "connecting"
    : "disconnected";

  useEffect(() => {
    const startCall = async () => {
      callStart.current = Date.now();
      try {
        console.log("[ElevenLabs] Fetching signed URL...");
        const t0 = Date.now();
        const res = await fetch("/api/signed-url");
        const { signedUrl } = await res.json();
        console.log(`[${new Date().toISOString()}] [ElevenLabs] Got signed URL (${Date.now() - t0}ms)`);

        console.log("[ElevenLabs] Starting session...");
        const t1 = Date.now();
        await conversation.startSession({
          signedUrl,
          clientTools: clientToolsRef.current,
        });
        console.log(`[${new Date().toISOString()}] [ElevenLabs] Session started (${Date.now() - t1}ms)`);
      } catch (err) {
        console.error("[ElevenLabs] Failed to start call:", err);
      }
    };
    startCall();
    return () => { conversation.endSession(); };
  }, []);

  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className={`h-3 w-3 rounded-full ${
              status === "connected" ? "bg-[var(--success)]" :
              status === "connecting" ? "bg-[var(--warning)]" : "bg-gray-400"
            }`} />
            {status === "connected" && (
              <div className="absolute inset-0 h-3 w-3 rounded-full bg-[var(--success)] animate-pulse-ring" />
            )}
          </div>
          <span className="text-sm font-medium text-[var(--text-muted)]">
            {status === "connected" ? "Verbonden" : status === "connecting" ? "Verbinden..." : "Verbroken"}
          </span>
        </div>
        <span className="text-xs text-[var(--text-muted)] bg-[var(--primary-light)] px-3 py-1 rounded-full">
          ElevenLabs
        </span>
      </div>

      {/* Audio visualizer */}
      <div className="flex items-center justify-center h-32 mb-6">
        <div className="flex items-end gap-1 h-16">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className={`w-1.5 rounded-full transition-all duration-150 ${
                status === "connected"
                  ? conversation.isSpeaking ? "bg-[var(--primary)]" : "bg-[var(--primary-light)]"
                  : "bg-gray-200"
              }`}
              style={{
                height: status === "connected" && conversation.isSpeaking
                  ? `${Math.random() * 100}%` : "20%",
                transition: "height 0.15s ease",
              }}
            />
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => setIsMuted(!isMuted)}
          className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
            isMuted ? "bg-[var(--danger-light)] text-[var(--danger)]" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {isMuted ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            )}
          </svg>
        </button>

        <button
          onClick={() => { conversation.endSession(); onEnd(); }}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--danger)] text-white hover:bg-red-700 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
