"use client";

import { useEffect, useRef, useState } from "react";
import {
  BellIcon,
  BellOffIcon,
  CloseIcon,
  PauseIcon,
  PlayIcon,
  RotateIcon,
} from "@/components/Icons";
import { playGentleBell } from "@/lib/chime";
import {
  calculateProgressPercent,
  formatTimerSeconds,
  SPRINT_PRESETS,
  type SprintStatus,
} from "@/lib/micro-timer";
import {
  DEFAULT_SOUNDSCAPE_VOLUME,
  getSoundscapeEngine,
  SOUNDSCAPE_OPTIONS,
  type SoundscapeType,
} from "@/lib/soundscapes";
import { MicroSprintCelebration } from "./MicroSprintCelebration";
import { MicroSprintPill } from "./MicroSprintPill";
import { SoundscapeControl } from "./SoundscapeControl";

export interface SprintTask {
  id: string;
  title: string;
}

export interface MicroSprintTimerProps {
  task: SprintTask;
  onCompleteTask: (taskId: string) => void;
  onClose: () => void;
}

export function MicroSprintTimer({
  task,
  onCompleteTask,
  onClose,
}: MicroSprintTimerProps) {
  const [durationMinutes, setDurationMinutes] = useState(5);
  const [remainingSeconds, setRemainingSeconds] = useState(5 * 60);
  const [status, setStatus] = useState<SprintStatus>("running");
  const [isChimeEnabled, setIsChimeEnabled] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);

  const [soundscape, setSoundscape] = useState<SoundscapeType>(() => {
    if (typeof window === "undefined") return "off";
    try {
      const saved = localStorage.getItem("clearstep_soundscape") as SoundscapeType | null;
      if (saved && SOUNDSCAPE_OPTIONS.some((opt) => opt.id === saved)) {
        return saved;
      }
    } catch {
      // ignore
    }
    return "off";
  });

  const [soundVolume, setSoundVolume] = useState<number>(() => {
    if (typeof window === "undefined") return DEFAULT_SOUNDSCAPE_VOLUME;
    try {
      const savedVol = localStorage.getItem("clearstep_soundscape_volume");
      if (savedVol) {
        const parsed = parseFloat(savedVol);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_SOUNDSCAPE_VOLUME;
  });

  // High-precision timing reference to avoid tab-throttling drift
  const targetEndRef = useRef<number>(Date.now() + 5 * 60 * 1000);
  const pausedRemainingRef = useRef<number>(5 * 60);
  const soundVolumeRef = useRef<number>(soundVolume);

  useEffect(() => {
    soundVolumeRef.current = soundVolume;
  }, [soundVolume]);

  // Manage Soundscape audio lifecycle
  useEffect(() => {
    const engine = getSoundscapeEngine();

    if (status === "running") {
      if (soundscape !== "off") {
        engine.play(soundscape, soundVolumeRef.current);
      } else {
        engine.stop();
      }
    } else if (status === "paused") {
      engine.pause();
    } else if (status === "finished") {
      engine.stop();
    }
  }, [status, soundscape]);

  // Cleanup audio nodes on unmount
  useEffect(() => {
    return () => {
      getSoundscapeEngine().stop();
    };
  }, []);

  // Sound chime when finished
  useEffect(() => {
    if (status === "finished" && isChimeEnabled) {
      playGentleBell(0.3);
    }
  }, [status, isChimeEnabled]);

  // Main countdown loop
  useEffect(() => {
    if (status !== "running") return;

    const intervalId = window.setInterval(() => {
      const now = Date.now();
      const diffSeconds = Math.ceil((targetEndRef.current - now) / 1000);

      if (diffSeconds <= 0) {
        setRemainingSeconds(0);
        setStatus("finished");
      } else {
        setRemainingSeconds(diffSeconds);
      }
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [status]);

  const onCloseRef = useRef(onClose);
  const togglePlayPauseRef = useRef<() => void>(() => {});

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    togglePlayPauseRef.current = togglePlayPause;
  });

  // Keyboard shortcuts: Space to toggle pause/play, Esc to dismiss
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === " " && status !== "finished") {
        e.preventDefault();
        togglePlayPauseRef.current();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [status]);

  function startSprint(mins: number) {
    setDurationMinutes(mins);
    const secs = mins * 60;
    setRemainingSeconds(secs);
    targetEndRef.current = Date.now() + secs * 1000;
    setStatus("running");
  }

  function togglePlayPause() {
    if (status === "running") {
      const currentLeft = Math.max(0, Math.ceil((targetEndRef.current - Date.now()) / 1000));
      pausedRemainingRef.current = currentLeft;
      setRemainingSeconds(currentLeft);
      setStatus("paused");
    } else if (status === "paused") {
      targetEndRef.current = Date.now() + pausedRemainingRef.current * 1000;
      setStatus("running");
    }
  }

  function handleReset() {
    startSprint(durationMinutes);
  }

  function handleExtend(mins = 5) {
    const extraSeconds = mins * 60;
    const nextTotal = durationMinutes + mins;
    const currentRemaining = status === "finished" ? 0 : Math.max(0, remainingSeconds);
    const nextRemaining = currentRemaining + extraSeconds;
    setDurationMinutes(nextTotal);
    setRemainingSeconds(nextRemaining);
    targetEndRef.current = Date.now() + nextRemaining * 1000;
    pausedRemainingRef.current = nextRemaining;
    setStatus("running");
  }

  function handleSelectSoundscape(type: SoundscapeType) {
    setSoundscape(type);
    try {
      localStorage.setItem("clearstep_soundscape", type);
    } catch {
      // ignore
    }
  }

  function handleVolumeChange(val: number) {
    setSoundVolume(val);
    soundVolumeRef.current = val;
    getSoundscapeEngine().setVolume(val);
    try {
      localStorage.setItem("clearstep_soundscape_volume", val.toString());
    } catch {
      // ignore
    }
  }

  const totalSeconds = durationMinutes * 60;
  const progressPercent = calculateProgressPercent(totalSeconds, remainingSeconds);

  // Minimized pill state
  if (isMinimized) {
    return (
      <MicroSprintPill
        remainingSeconds={remainingSeconds}
        taskTitle={task.title}
        soundscape={soundscape}
        onRestore={() => setIsMinimized(false)}
        onClose={onClose}
      />
    );
  }

  return (
    <aside
      className="micro-sprint-floating-card"
      role="region"
      aria-label="5-Minute Micro-Action Timer"
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 900,
        maxWidth: 420,
        width: "calc(100vw - 32px)",
        background: "var(--surface)",
        border: "2px solid var(--accent)",
        borderRadius: 16,
        boxShadow: "0 12px 36px rgba(0,0,0,0.2)",
        padding: 20,
        transition: "transform 0.2s ease",
      }}
    >
      {/* Top Bar: Title & Min/Close */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="pill pill-primary" style={{ fontSize: "0.8rem", padding: "2px 8px" }}>
            ⏱️ 5-Min Sprint
          </span>
          <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
            Anti-procrastination
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setIsChimeEnabled((prev) => !prev)}
            title={isChimeEnabled ? "Chime enabled (click to mute)" : "Chime muted (click to enable)"}
            aria-label={isChimeEnabled ? "Mute chime" : "Enable chime"}
            style={{ padding: "4px 6px" }}
          >
            {isChimeEnabled ? (
              <BellIcon style={{ width: 14, height: 14 }} />
            ) : (
              <BellOffIcon style={{ width: 14, height: 14, color: "var(--muted)" }} />
            )}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setIsMinimized(true)}
            title="Minimize timer"
            aria-label="Minimize timer"
            style={{ padding: "4px 6px" }}
          >
            _
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            title="Stop & Close (Esc)"
            aria-label="Close timer"
            style={{ padding: "4px 6px" }}
          >
            <CloseIcon style={{ width: 14, height: 14 }} />
          </button>
        </div>
      </div>

      {/* Task Headline */}
      <h3
        style={{
          fontSize: "1rem",
          fontWeight: 700,
          margin: "0 0 14px",
          color: "var(--foreground)",
          lineHeight: 1.4,
          overflow: "hidden",
          textOverflow: "ellipsis",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}
      >
        {task.title}
      </h3>

      {/* Finished Celebration State vs Running Timer State */}
      {status === "finished" ? (
        <MicroSprintCelebration
          taskId={task.id}
          onCompleteTask={onCompleteTask}
          onExtend={handleExtend}
          onClose={onClose}
        />
      ) : (
        <>
          {/* Main Countdown Display */}
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <div
              style={{
                fontSize: "2.4rem",
                fontWeight: 900,
                fontFamily: "monospace",
                color: "var(--foreground)",
                letterSpacing: "-0.02em",
              }}
              id="micro-sprint-display"
              aria-live="polite"
            >
              {formatTimerSeconds(remainingSeconds)}
            </div>

            <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
              {status === "paused" ? "Paused" : "Stay on this one step"}
            </span>
          </div>

          {/* Progress Bar */}
          <div
            style={{
              width: "100%",
              height: 6,
              background: "var(--border)",
              borderRadius: 3,
              overflow: "hidden",
              marginBottom: 14,
            }}
          >
            <div
              style={{
                width: `${progressPercent}%`,
                height: "100%",
                background: "var(--accent)",
                transition: "width 0.25s linear",
              }}
            />
          </div>

          {/* Soundscapes Acoustic Shield Selector */}
          <SoundscapeControl
            soundscape={soundscape}
            soundVolume={soundVolume}
            isRunning={status === "running"}
            onSelectSoundscape={handleSelectSoundscape}
            onVolumeChange={handleVolumeChange}
          />

          {/* Preset Buttons & Controls */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ display: "flex", gap: 4 }}>
              {SPRINT_PRESETS.map((preset) => (
                <button
                  key={preset.minutes}
                  type="button"
                  className={`btn btn-sm ${
                    durationMinutes === preset.minutes ? "btn-primary" : "btn-outline"
                  }`}
                  onClick={() => startSprint(preset.minutes)}
                  style={{ fontSize: "0.75rem", padding: "4px 8px" }}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={togglePlayPause}
                id="micro-sprint-toggle-btn"
                title={status === "running" ? "Pause timer (Space)" : "Resume timer (Space)"}
                aria-label={status === "running" ? "Pause timer" : "Resume timer"}
              >
                {status === "running" ? <PauseIcon style={{ width: 14, height: 14 }} /> : <PlayIcon style={{ width: 14, height: 14 }} />}
                <span>{status === "running" ? "Pause" : "Resume"}</span>
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleReset}
                title="Reset timer"
                aria-label="Reset timer"
              >
                <RotateIcon style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
