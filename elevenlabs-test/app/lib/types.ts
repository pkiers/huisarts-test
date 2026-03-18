import type { TranscriptMessage } from "../components/Transcript";
import type { ToolCallEvent } from "../components/ToolCards";

export type Provider = "elevenlabs" | "gemini";
export type CallStatus = "connecting" | "connected" | "disconnected";

export interface CallCallbacks {
  onTranscript: (msg: TranscriptMessage) => void;
  onToolCall: (tc: ToolCallEvent) => void;
  onEnd: () => void;
}

export interface CallState {
  status: CallStatus;
  isSpeaking: boolean;
}
