"use client";

import { useEffect, useRef, useState } from "react";
import {
  BellIcon,
  BellOffIcon,
  CheckIcon,
  ClockIcon,
  CloseIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  RotateIcon,
  SparkIcon,
} from "@/components/Icons";
import { playGentleBell } from "@/lib/chime";
import {
  calculateProgressPercent,
  formatTimerSeconds,
  SPRINT_PRESETS,
  type SprintStatus,
} from "@/lib/micro-timer";

export interface SprintTask {
  id: string;
  title: string;
}

interface MicroSprintTimerProps {
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

  // High-precision timing reference to avoid tab-throttling drift
  const targetEndRef = useRef<number>(Date.now() + 5 * 60 * 1000);
  const pausedRemainingRef = useRef<number>(5 * 60);

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

  // Keyboard shortcuts: Space to toggle pause/play, Esc to dismiss
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === " " && status !== "finished") {
        e.preventDefault();
        togglePlayPause();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  function startSprint(mins: number) {
    setDurationMinutes(mins);
    const secs = mins * 60;
    setRemainingSeconds(secs);
    targetEndRef.current = Date.now() + secs * 1000;
    setStatus("running");
  }

  function togglePlayPause() {
    if (status === "running") {
      pausedRemainingRef.current = remainingSeconds;
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
    setDurationMinutes(nextTotal);
    setRemainingSeconds(extraSeconds);
    targetEndRef.current = Date.now() + extraSeconds * 1000;
    setStatus("running");
  }

  const totalSeconds = durationMinutes * 60;
  const progressPercent = calculateProgressPercent(totalSeconds, remainingSeconds);

  // Minimized pill state
  if (isMinimized) {
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
        onClick={() => setIsMinimized(false)}
      >
        <ClockIcon style={{ width: 18, height: 18, color: "var(--acid)" }} />
        <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "1.05rem" }}>
          {formatTimerSeconds(remainingSeconds)}
        </span>
        <span style={{ fontSize: "0.85rem", opacity: 0.85, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {task.title}
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

      {/* Finished State vs Running State */}
      {status === "finished" ? (
        <div style={{ textAlign: "center", padding: "12px 0 6px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "var(--acid-soft)",
              color: "var(--forest)",
              marginBottom: 10,
            }}
          >
            <SparkIcon style={{ width: 22, height: 22 }} />
          </div>

          <h4 style={{ fontSize: "1.15rem", fontWeight: 800, margin: "0 0 6px" }}>
            5 Minutes Completed!
          </h4>
          <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: "0 0 16px", lineHeight: 1.4 }}>
            You broke the initial friction. Momentum is established. How do you feel?
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              type="button"
              className="btn btn-primary"
              id="micro-sprint-done-btn"
              onClick={() => {
                onCompleteTask(task.id);
                onClose();
              }}
            >
              <CheckIcon /> Mark Step as Done!
            </button>
            <button
              type="button"
              className="btn btn-outline"
              id="micro-sprint-extend-btn"
              onClick={() => handleExtend(5)}
            >
              <PlusIcon /> Keep Going (+5 mins)
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onClose}
              style={{ color: "var(--muted)", fontSize: "0.8rem" }}
            >
              I gave it 5 mins, that&apos;s enough today (zero guilt)
            </button>
          </div>
        </div>
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
              marginBottom: 16,
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
