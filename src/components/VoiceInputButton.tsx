"use client";

import { useState } from "react";
import { MicIcon, MicOffIcon } from "@/components/Icons";
import { useVoiceDictation } from "@/lib/use-voice-dictation";

interface VoiceInputButtonProps {
  onTranscriptChunk: (chunk: string) => void;
  disabled?: boolean;
  className?: string;
}

export function VoiceInputButton({
  onTranscriptChunk,
  disabled = false,
  className = "",
}: VoiceInputButtonProps) {
  const [interim, setInterim] = useState("");

  const {
    isSupported,
    isListening,
    error,
    toggleListening,
  } = useVoiceDictation({
    onTranscriptChunk: (chunk) => {
      onTranscriptChunk(chunk);
    },
    onInterimChange: (text) => {
      setInterim(text);
    },
  });

  if (!isSupported) {
    return (
      <span
        style={{
          fontSize: "12px",
          color: "var(--muted)",
          fontStyle: "italic",
        }}
        title="Voice dictation is supported in modern Chrome, Edge, and Safari."
      >
        🎙️ Voice dictation supported in Chrome & Safari
      </span>
    );
  }

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <button
        type="button"
        className={`voice-btn ${isListening ? "is-listening" : ""} ${className}`}
        onClick={toggleListening}
        disabled={disabled}
        aria-pressed={isListening}
        aria-label={isListening ? "Stop voice dictation" : "Start speaking your thoughts"}
        title={isListening ? "Stop listening" : "Speak out loud — your words stream into the dump"}
      >
        {isListening ? (
          <>
            <span className="voice-pulse-dot" aria-hidden="true" />
            <MicOffIcon style={{ width: 14, height: 14 }} />
            <span>Listening... (click to stop)</span>
          </>
        ) : (
          <>
            <MicIcon style={{ width: 14, height: 14 }} />
            <span>Speak your mind 🎙️</span>
          </>
        )}
      </button>

      {/* Live Interim Speech Preview */}
      {isListening && interim && (
        <div className="voice-interim-box" aria-live="polite">
          <span style={{ opacity: 0.7 }}>Hearing:</span>
          <span>&ldquo;{interim}&rdquo;</span>
        </div>
      )}

      {/* Non-intrusive Error Callout */}
      {error && (
        <div
          role="alert"
          style={{
            fontSize: "12px",
            color: "var(--danger)",
            background: "rgba(180, 40, 40, 0.08)",
            padding: "4px 8px",
            borderRadius: 6,
            marginTop: 4,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
