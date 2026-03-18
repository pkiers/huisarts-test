"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import CallUI from "./CallUI";
import { createClientTools, geminiToolDeclarations } from "../lib/tools";
import type { CallCallbacks, CallStatus } from "../lib/types";

interface GeminiCallProps extends CallCallbacks {}

const SYSTEM_PROMPT = `Je bent Lisa, de AI-telefoonassistente van Huisartspraktijk De Gezondheid. Je spreekt Nederlands.

Je helpt bellers met:
- Het plannen, wijzigen of annuleren van afspraken
- Herhaalrecepten aanvragen
- Triage bij medische klachten
- Doorverbinden met de juiste medewerker
- Terugbelverzoeken inplannen
- Berichten achterlaten

Wees vriendelijk, professioneel en beknopt. Vraag altijd eerst naar de naam van de beller zodat je de patientgegevens kunt opzoeken. Spreek de beller aan met u/uw.

Bij urgente medische klachten (pijn op de borst, ademnood, bewusteloosheid, ernstige bloeding) escaleer direct via de escalate_urgent tool.`;

/** Convert a Float32Array ([-1,1]) to Int16 PCM bytes encoded as base64 */
function float32ToBase64Pcm(float32: Float32Array): string {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(int16.buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** Decode base64 PCM (Int16) to Float32Array for AudioContext playback */
function base64PcmToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7fff);
  }
  return float32;
}

export default function GeminiCall({
  onTranscript,
  onToolCall,
  onEnd,
}: GeminiCallProps) {
  const [status, setStatus] = useState<CallStatus>("connecting");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const playQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);
  const clientToolsRef = useRef(createClientTools(onToolCall));
  const isMutedRef = useRef(false);

  // Keep mute ref in sync
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const playAudioQueue = useCallback(() => {
    if (isPlayingRef.current || playQueueRef.current.length === 0) return;
    isPlayingRef.current = true;
    setIsSpeaking(true);

    const ctx = audioCtxRef.current;
    if (!ctx) {
      isPlayingRef.current = false;
      setIsSpeaking(false);
      return;
    }

    const playNext = () => {
      if (playQueueRef.current.length === 0) {
        isPlayingRef.current = false;
        setIsSpeaking(false);
        return;
      }

      const samples = playQueueRef.current.shift()!;
      // Gemini outputs 24kHz PCM
      const buffer = ctx.createBuffer(1, samples.length, 24000);
      buffer.getChannelData(0).set(samples);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = playNext;
      source.start();
    };

    playNext();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      try {
        // 1. Get Vertex AI access token from server
        const configRes = await fetch("/api/gemini-config");
        if (!configRes.ok) throw new Error("Failed to fetch Gemini config");
        const { accessToken, wsUrl: vertexWsUrl, model } = await configRes.json();

        if (cancelled) return;

        // 2. Open WebSocket to Vertex AI BidiGenerateContent
        const ws = new WebSocket(`${vertexWsUrl}?model=${encodeURIComponent(model)}`, [
          "Bearer",
          accessToken,
        ]);
        wsRef.current = ws;

        ws.onopen = () => {
          // Send setup message
          const setup = {
            setup: {
              generation_config: {
                response_modalities: ["AUDIO"],
                speech_config: {
                  voice_config: {
                    prebuilt_voice_config: {
                      voice_name: "Kore",
                    },
                  },
                },
              },
              system_instruction: {
                parts: [{ text: SYSTEM_PROMPT }],
              },
              tools: geminiToolDeclarations,
              output_audio_transcription: {},
              input_audio_transcription: {},
            },
          };
          ws.send(JSON.stringify(setup));
        };

        ws.onmessage = async (event) => {
          try {
            const data = JSON.parse(
              typeof event.data === "string"
                ? event.data
                : await (event.data as Blob).text()
            );

            // Setup complete
            if (data.setupComplete) {
              if (!cancelled) {
                setStatus("connected");
                startMicCapture();
              }
              return;
            }

            // Server content (audio + transcripts)
            if (data.serverContent) {
              const sc = data.serverContent;

              // Audio data
              if (sc.modelTurn?.parts) {
                for (const part of sc.modelTurn.parts) {
                  if (part.inlineData?.data) {
                    const samples = base64PcmToFloat32(part.inlineData.data);
                    playQueueRef.current.push(samples);
                    playAudioQueue();
                  }
                }
              }

              // Output transcription (agent)
              if (sc.outputTranscription?.text) {
                onTranscript({
                  id: crypto.randomUUID(),
                  role: "agent",
                  text: sc.outputTranscription.text,
                  timestamp: new Date().toISOString(),
                });
              }

              // Input transcription (user)
              if (sc.inputTranscription?.text) {
                onTranscript({
                  id: crypto.randomUUID(),
                  role: "user",
                  text: sc.inputTranscription.text,
                  timestamp: new Date().toISOString(),
                });
              }
            }

            // Tool calls
            if (data.toolCall?.functionCalls) {
              const responses = [];
              for (const fc of data.toolCall.functionCalls) {
                const handler = clientToolsRef.current[fc.name];
                if (handler) {
                  const resultStr = await handler(fc.args || {});
                  responses.push({
                    name: fc.name,
                    id: fc.id,
                    response: JSON.parse(resultStr),
                  });
                } else {
                  responses.push({
                    name: fc.name,
                    id: fc.id,
                    response: { error: "Unknown tool" },
                  });
                }
              }
              // Send tool responses back
              ws.send(
                JSON.stringify({
                  toolResponse: { functionResponses: responses },
                })
              );
            }
          } catch (err) {
            console.error("Error processing Gemini message:", err);
          }
        };

        ws.onerror = (err) => {
          console.error("Gemini WebSocket error:", err);
          if (!cancelled) {
            setStatus("disconnected");
          }
        };

        ws.onclose = () => {
          if (!cancelled) {
            setStatus("disconnected");
            onEnd();
          }
        };
      } catch (err) {
        console.error("Failed to start Gemini call:", err);
        if (!cancelled) {
          setStatus("disconnected");
        }
      }
    };

    const startMicCapture = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
        streamRef.current = stream;

        // Create AudioContext at 16kHz for mic capture
        const audioCtx = new AudioContext({ sampleRate: 16000 });
        audioCtxRef.current = audioCtx;

        const source = audioCtx.createMediaStreamSource(stream);
        // Use ScriptProcessorNode for simplicity (deprecated but widely supported)
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (isMutedRef.current) return;
          const ws = wsRef.current;
          if (!ws || ws.readyState !== WebSocket.OPEN) return;

          const inputData = e.inputBuffer.getChannelData(0);
          const base64 = float32ToBase64Pcm(inputData);

          ws.send(
            JSON.stringify({
              realtime_input: {
                media_chunks: [
                  {
                    data: base64,
                    mime_type: "audio/pcm;rate=16000",
                  },
                ],
              },
            })
          );
        };

        source.connect(processor);
        processor.connect(audioCtx.destination);
      } catch (err) {
        console.error("Failed to capture microphone:", err);
      }
    };

    start();

    return () => {
      cancelled = true;
      // Cleanup
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMuteToggle = () => {
    setIsMuted((prev) => !prev);
  };

  const handleHangUp = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    onEnd();
  };

  return (
    <CallUI
      status={status}
      isSpeaking={isSpeaking}
      provider="gemini"
      mode="web-call"
      onMuteToggle={handleMuteToggle}
      isMuted={isMuted}
      onHangUp={handleHangUp}
    />
  );
}
