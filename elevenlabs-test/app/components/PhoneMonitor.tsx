"use client";

import { useState, useEffect, useRef } from "react";
import { Room, RoomEvent } from "livekit-client";
import type { TranscriptMessage } from "./Transcript";
import type { ToolCallEvent } from "./ToolCards";

interface PhoneMonitorProps {
  onTranscript: (msg: TranscriptMessage) => void;
  onToolCall: (tc: ToolCallEvent) => void;
  onEnd: () => void;
}

export default function PhoneMonitor({ onTranscript, onToolCall, onEnd }: PhoneMonitorProps) {
  const [status, setStatus] = useState<"waiting" | "connected" | "disconnected">("waiting");
  const roomRef = useRef<Room | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    const connectToRoom = async (roomName: string) => {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/livekit-token?room=${encodeURIComponent(roomName)}`);
        const { token, url } = await res.json();

        const room = new Room();
        roomRef.current = room;

        room.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
          try {
            const event = JSON.parse(new TextDecoder().decode(payload));
            console.log("LiveKit data received:", event);
            if (event.type === "transcript") {
              onTranscript({
                id: crypto.randomUUID(),
                role: event.role,
                text: event.text,
                timestamp: event.timestamp || new Date().toISOString(),
              });
            } else if (event.type === "tool_call") {
              onToolCall({
                id: crypto.randomUUID(),
                tool: event.tool,
                args: event.args,
                result: event.result,
                timestamp: new Date().toISOString(),
              });
            } else if (event.type === "call_ended") {
              setStatus("disconnected");
            }
          } catch { /* ignore */ }
        });

        room.on(RoomEvent.Disconnected, () => setStatus("disconnected"));

        await room.connect(url, token);
        console.log("Connected to LiveKit room:", roomName, "participants:", room.remoteParticipants.size);
        setStatus("connected");
      } catch (err) {
        console.error("Failed to connect to LiveKit room:", err);
      }
    };

    // Poll for active rooms, connect when one appears
    const findRoom = async () => {
      try {
        const res = await fetch("/api/livekit-rooms");
        const data = await res.json();
        const activeRooms = (data.rooms || []).filter((r: { numParticipants: number }) => r.numParticipants > 0);
        console.log("Active rooms:", activeRooms);
        if (activeRooms.length > 0 && !roomRef.current) {
          if (pollRef.current) clearInterval(pollRef.current);
          await connectToRoom(activeRooms[activeRooms.length - 1].name);
        }
      } catch { /* ignore */ }
    };

    findRoom();
    pollRef.current = setInterval(findRoom, 2000);

    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
      if (roomRef.current) roomRef.current.disconnect();
    };
  }, []);

  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className={`h-3 w-3 rounded-full ${
              status === "connected" ? "bg-[var(--success)]" :
              status === "waiting" ? "bg-[var(--warning)]" : "bg-gray-400"
            }`} />
            {status === "connected" && (
              <div className="absolute inset-0 h-3 w-3 rounded-full bg-[var(--success)] animate-pulse-ring" />
            )}
          </div>
          <span className="text-sm font-medium text-[var(--text-muted)]">
            {status === "connected" ? "Verbonden — meekijken" :
             status === "waiting" ? "Wachten op telefoongesprek..." : "Verbroken"}
          </span>
        </div>
        <span className="text-xs text-[var(--text-muted)] bg-[var(--success-light)] px-3 py-1 rounded-full">
          Telefoon
        </span>
      </div>

      <div className="flex items-center justify-center h-32 mb-6">
        {status === "waiting" ? (
          <p className="text-[var(--text-muted)] text-sm text-center">
            Bel 058-203 8458 om een gesprek te starten.<br />
            Het transcript verschijnt hier live.
          </p>
        ) : status === "connected" ? (
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-[var(--success)] animate-pulse" />
            <span className="text-sm text-[var(--success)] font-medium">Live gesprek actief</span>
          </div>
        ) : (
          <p className="text-[var(--text-muted)] text-sm">Gesprek beëindigd</p>
        )}
      </div>

      <div className="flex items-center justify-center">
        <button
          onClick={onEnd}
          className="rounded-xl border border-[var(--card-border)] px-6 py-2 text-sm text-[var(--text-muted)] hover:bg-gray-50 transition-colors"
        >
          Stoppen met meekijken
        </button>
      </div>
    </div>
  );
}
