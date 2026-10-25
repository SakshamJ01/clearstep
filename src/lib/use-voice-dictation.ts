"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

// Types for Web Speech API
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEvent) => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export interface UseVoiceDictationOptions {
  onTranscriptChunk?: (chunk: string) => void;
  onInterimChange?: (interim: string) => void;
  lang?: string;
}

export function formatSpokenChunk(previousText: string, chunk: string): string {
  const trimmedChunk = chunk.trim();
  if (!trimmedChunk) return previousText;
  const capitalized = trimmedChunk.charAt(0).toUpperCase() + trimmedChunk.slice(1);
  const trimmedPrev = previousText.trim();
  if (!trimmedPrev) {
    return `• ${capitalized}`;
  }
  return `${trimmedPrev}\n• ${capitalized}`;
}

function checkSpeechSupport(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function emptySubscribe() {
  return () => {};
}

export function useVoiceDictation({
  onTranscriptChunk,
  onInterimChange,
  lang = "en-US",
}: UseVoiceDictationOptions = {}) {
  const isSupported = useSyncExternalStore(
    emptySubscribe,
    checkSpeechSupport,
    () => false,
  );
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const userStoppedRef = useRef(false);

  const stopListening = useCallback(() => {
    userStoppedRef.current = true;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore if already stopped
      }
    }
    setIsListening(false);
    setInterimText("");
  }, []);

  const startListening = useCallback(() => {
    setError(null);
    setInterimText("");
    userStoppedRef.current = false;

    if (typeof window === "undefined") return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = lang;

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      recognition.onend = () => {
        // If browser stopped recognition but user didn't request stop, auto-restart
        if (!userStoppedRef.current && isListening) {
          try {
            recognition.start();
            return;
          } catch {
            // Ignore restart error
          }
        }
        setIsListening(false);
        setInterimText("");
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error === "no-speech") {
          // Normal pause in speech, don't show error
          return;
        }
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setError("Microphone permission was denied. Please allow microphone access in your browser settings.");
        } else if (event.error === "network") {
          setError("Network issue during speech recognition. Check your connection.");
        } else {
          setError(`Speech recognition notice: ${event.error}`);
        }
        setIsListening(false);
        setInterimText("");
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalChunk = "";
        let currentInterim = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i];
          if (!result) continue;
          const transcript = result[0]?.transcript || "";
          if (result.isFinal) {
            finalChunk += transcript;
          } else {
            currentInterim += transcript;
          }
        }

        if (finalChunk) {
          const trimmed = finalChunk.trim();
          if (trimmed) {
            onTranscriptChunk?.(trimmed);
          }
        }

        setInterimText(currentInterim);
        onInterimChange?.(currentInterim);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      setError("Could not start microphone dictation. Please try again.");
      setIsListening(false);
    }
  }, [isListening, lang, onInterimChange, onTranscriptChunk]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      userStoppedRef.current = true;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return {
    isSupported,
    isListening,
    interimText,
    error,
    startListening,
    stopListening,
    toggleListening,
  };
}
