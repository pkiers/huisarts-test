"use client";

import { useState, useEffect, useRef } from "react";
import { useConversation } from "@elevenlabs/react";
import CallUI from "./CallUI";
import { createClientTools } from "../lib/tools";
import type { CallCallbacks, CallStatus } from "../lib/types";

interface ElevenLabsCallProps extends CallCallbacks {}

export default function ElevenLabsCall({
  onTranscript,
  onToolCall,
  onEnd,
}: ElevenLabsCallProps) {
  const [isMuted, setIsMuted] = useState(false);
  const clientToolsRef = useRef(createClientTools(onToolCall));

  const conversation = useConversation({
    onDisconnect: () => {
      onEnd();
    },
    onMessage: (message) => {
      onTranscript({
        id: crypto.randomUUID(),
        role: message.role === "user" ? "user" : "agent",
        text: message.message,
        timestamp: new Date().toISOString(),
      });
    },
  });

  const status: CallStatus =
    conversation.status === "connected"
      ? "connected"
      : conversation.status === "connecting"
      ? "connecting"
      : "disconnected";

  useEffect(() => {
    const startCall = async () => {
      try {
        const res = await fetch("/api/signed-url");
        const { signedUrl } = await res.json();
        await conversation.startSession({
          signedUrl,
          clientTools: clientToolsRef.current,
        });
      } catch (err) {
        console.error("Failed to start ElevenLabs call:", err);
      }
    };
    startCall();

    return () => {
      conversation.endSession();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMuteToggle = () => {
    setIsMuted((prev) => !prev);
  };

  const handleHangUp = () => {
    conversation.endSession();
    onEnd();
  };

  return (
    <CallUI
      status={status}
      isSpeaking={conversation.isSpeaking}
      provider="elevenlabs"
      mode="web-call"
      onMuteToggle={handleMuteToggle}
      isMuted={isMuted}
      onHangUp={handleHangUp}
    />
  );
}
