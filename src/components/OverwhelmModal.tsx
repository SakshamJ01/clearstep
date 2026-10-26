"use client";

import { useEffect } from "react";
import { EmergencyDeescalateStudio } from "@/components/EmergencyDeescalateStudio";

interface OverwhelmModalProps {
  open: boolean;
  onClose: () => void;
  initialHeaviestThought?: string;
}

export function OverwhelmModal({
  open,
  onClose,
  initialHeaviestThought = "",
}: OverwhelmModalProps) {
  // ESC key listener
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Emergency overwhelm first-aid reset"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(16, 51, 38, 0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1100,
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="modal-card overwhelm-modal-card"
        style={{
          background: "var(--paper-bright)",
          border: "1px solid var(--border-soft)",
          borderRadius: 20,
          maxWidth: 640,
          width: "100%",
          maxHeight: "92vh",
          overflowY: "auto",
          padding: "24px 28px",
          boxShadow: "var(--shadow-float)",
        }}
      >
        <EmergencyDeescalateStudio
          onDismiss={onClose}
          isModal={true}
          initialHeaviestThought={initialHeaviestThought}
        />
      </div>
    </div>
  );
}
