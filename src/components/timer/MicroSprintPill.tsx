"use client";

import { ClockIcon, CloseIcon } from "@/components/Icons";
import { formatTimerSeconds } from "@/lib/micro-timer";
import { SOUNDSCAPE_OPTIONS, type SoundscapeType } from "@/lib/soundscapes";

interface MicroSprintPillProps {
  remainingSeconds: number;
  taskTitle: string;
  soundscape: SoundscapeType;
  onRestore: () => void;
  onClose: () => void;
}

export function MicroSprintPill({
  remainingSeconds,
  taskTitle,
  soundscape,
  onRestore,
  onClose,
}: MicroSprintPillProps) {
  const activeSoundscapeOption = SOUNDSCAPE_OPTIONS.find((s) => s.id === soundscape);

  return (
    <aside
      className="micro-sprint-pill"
      role="region"
      aria-label="Active sprint timer"
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 900,
        background: "var(--forest)",
        color: "var(--paper-bright)",
        padding: "10px 16px",
        borderRadius: 30,
        boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        cursor: "pointer",
        border: "1px solid var(--accent)",
      }}
      onClick={onRestore}
    >
      <ClockIcon style={{ width: 18, height: 18, color: "var(--acid)" }} />
      <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "1.05rem" }}>
        {formatTimerSeconds(remainingSeconds)}
      </span>
      {soundscape !== "off" && activeSoundscapeOption && (
        <span
          style={{
            fontSize: "0.8rem",
            background: "rgba(255,255,255,0.18)",
            padding: "2px 8px",
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
          title={`Soundscape: ${activeSoundscapeOption.label}`}
        >
          <span>🎧</span>
          <span>{activeSoundscapeOption.shortLabel}</span>
        </span>
      )}
      <span
        style={{
          fontSize: "0.85rem",
          opacity: 0.85,
          maxWidth: 140,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {taskTitle}
      </span>
      <button
        type="button"
        className="icon-btn"
        style={{ color: "var(--paper-bright)", padding: 2 }}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close timer"
      >
        <CloseIcon style={{ width: 14, height: 14 }} />
      </button>
    </aside>
  );
}
