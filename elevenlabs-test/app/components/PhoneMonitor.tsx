"use client";

import { useState, useEffect, useRef } from "react";
import CallUI from "./CallUI";
import type { CallCallbacks, CallStatus, Provider } from "../lib/types";

interface PhoneMonitorProps extends CallCallbacks {
  provider: Provider;
}

export default function PhoneMonitor({
  provider,
  onTranscript,
  onToolCall,
  onEnd,
}: PhoneMonitorProps) {
  const [phoneStatus, setPhoneStatus] = useState<CallStatus>("connecting");

  useEffect(() => {
    const seenIds = new Set<number>();

    const poll = async () => {
      try {
        const res = await fetch("/api/call/status?since=0");
        const data = await res.json();

        if (data.connected) {
          setPhoneStatus("connected");
        }

        if (data.events) {
          for (const event of data.events) {
            const eventId = event.id as number;
            if (seenIds.has(eventId)) continue;
            seenIds.add(eventId);

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
                timestamp: event.timestamp || new Date().toISOString(),
              });
            } else if (event.type === "call_ended") {
              setPhoneStatus("disconnected");
              onEnd();
            }
          }
        }

        if (data.ended) {
          setPhoneStatus("disconnected");
          onEnd();
        }
      } catch {
        // ignore poll errors
      }
    };

    const interval = setInterval(poll, 1000);
    poll();

    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleHangUp = () => {
    onEnd();
  };

  return (
    <CallUI
      status={phoneStatus}
      isSpeaking={false}
      provider={provider}
      mode="phone-monitor"
      onHangUp={handleHangUp}
    />
  );
}
