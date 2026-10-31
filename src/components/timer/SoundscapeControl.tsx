"use client";

import { HeadphonesIcon, VolumeIcon } from "@/components/Icons";
import { SOUNDSCAPE_OPTIONS, type SoundscapeType } from "@/lib/soundscapes";

interface SoundscapeControlProps {
  soundscape: SoundscapeType;
  soundVolume: number;
  isRunning: boolean;
  onSelectSoundscape: (type: SoundscapeType) => void;
  onVolumeChange: (vol: number) => void;
}

export function SoundscapeControl({
  soundscape,
  soundVolume,
  isRunning,
  onSelectSoundscape,
  onVolumeChange,
}: SoundscapeControlProps) {
  return (
    <div
      style={{
        marginBottom: 14,
        padding: "10px 12px",
        background: "var(--surface-sunken)",
        borderRadius: 10,
        border: "1px solid var(--border)",
      }}
      id="micro-soundscapes-container"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem", fontWeight: 700 }}>
          <HeadphonesIcon style={{ width: 14, height: 14, color: "var(--accent)" }} />
          <span>Focus Soundscape</span>
          {soundscape !== "off" && isRunning && (
            <span
              style={{
                fontSize: "0.7rem",
                color: "var(--accent)",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--accent)",
                  display: "inline-block",
                }}
              />
              Active
            </span>
          )}
        </div>

        {soundscape !== "off" && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <VolumeIcon style={{ width: 13, height: 13, color: "var(--muted)" }} />
            <input
              type="range"
              id="soundscape-volume-slider"
              min="0.05"
              max="0.8"
              step="0.05"
              value={soundVolume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              style={{ width: 55, height: 4, cursor: "pointer", accentColor: "var(--accent)" }}
              aria-label="Soundscape volume"
              title={`Volume: ${Math.round(soundVolume * 100)}%`}
            />
            <span style={{ fontSize: "0.7rem", color: "var(--muted)", minWidth: 26, textAlign: "right" }}>
              {Math.round(soundVolume * 100)}%
            </span>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
        {SOUNDSCAPE_OPTIONS.map((opt) => {
          const isSelected = soundscape === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              id={`soundscape-btn-${opt.id}`}
              className={`btn btn-sm ${isSelected ? "btn-primary" : "btn-outline"}`}
              onClick={() => onSelectSoundscape(opt.id)}
              style={{
                fontSize: "0.7rem",
                padding: "4px 2px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                lineHeight: 1.1,
                borderWidth: isSelected ? 2 : 1,
              }}
              title={`${opt.label}: ${opt.description}`}
              aria-pressed={isSelected}
            >
              <span style={{ fontSize: "0.9rem" }}>{opt.emoji}</span>
              <span style={{ fontSize: "0.68rem", fontWeight: isSelected ? 700 : 500 }}>
                {opt.shortLabel}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
