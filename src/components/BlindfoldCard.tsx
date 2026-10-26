"use client";

import { useEffect, useState } from "react";
import {
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  CloseIcon,
  EyeIcon,
  NoteIcon,
  RotateIcon,
  ShareIcon,
  SparkIcon,
} from "@/components/Icons";
import { formatEffort } from "@/lib/format";

export interface BlindfoldTask {
  id: string;
  title: string;
  description: string;
  effortMin: number | null;
  effortMax: number | null;
  status: string;
  note: string;
}

interface BlindfoldCardProps {
  task: BlindfoldTask | null; // null means all tasks are completed!
  stepNumber: number;
  totalSteps: number;
  completedCount: number;
  onComplete: (taskId: string) => void;
  onSkip: () => void;
  onUpdateNote: (taskId: string, note: string) => void;
  onExit: () => void;
  onReset?: () => void;
  onShare?: () => void;
}

export function BlindfoldCard({
  task,
  stepNumber,
  totalSteps,
  completedCount,
  onComplete,
  onSkip,
  onUpdateNote,
  onExit,
  onReset,
  onShare,
}: BlindfoldCardProps) {
  const [isNoteOpen, setIsNoteOpen] = useState(false);

  // Global keyboard shortcuts (Esc to exit, Cmd/Ctrl + Enter to complete)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onExit();
      } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        if (task) {
          e.preventDefault();
          onComplete(task.id);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onExit, onComplete, task]);

  // Celebration Victory Screen if all steps are done
  if (!task || completedCount === totalSteps) {
    return (
      <section
        className="blindfold-victory-card"
        style={{
          maxWidth: 680,
          margin: "32px auto",
          padding: "40px 32px",
          textAlign: "center",
          background: "var(--surface)",
          border: "2px solid var(--accent)",
          borderRadius: 16,
          boxShadow: "0 12px 36px rgba(0,0,0,0.08)",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "var(--acid-soft)",
            color: "var(--forest)",
            marginBottom: 20,
          }}
        >
          <SparkIcon style={{ width: 32, height: 32 }} />
        </div>

        <span className="pill pill-success" style={{ marginBottom: 12 }}>
          Plan Completed
        </span>

        <h1 style={{ fontSize: "2.2rem", fontWeight: 800, marginBottom: 12 }}>
          You did it. Everything is finished.
        </h1>

        <p
          style={{
            color: "var(--muted)",
            fontSize: "1.1rem",
            maxWidth: 480,
            margin: "0 auto 28px",
            lineHeight: 1.6,
          }}
        >
          Take a deep breath. You took an anxious, chaotic brain dump and completed all {totalSteps} steps, one clear action at a time.
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
          {onShare && (
            <button
              type="button"
              className="btn btn-primary btn-lg"
              id="blindfold-share-victory-btn"
              onClick={onShare}
            >
              <ShareIcon /> Share Momentum Card
            </button>
          )}
          <button
            type="button"
            className="btn btn-outline btn-lg"
            onClick={onExit}
          >
            <EyeIcon /> View Full Plan Overview
          </button>
          {onReset && (
            <button
              type="button"
              className="btn btn-ghost btn-lg"
              onClick={onReset}
            >
              <RotateIcon /> Start a New Dump
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <div className="blindfold-overlay-container" style={{ maxWidth: 720, margin: "24px auto" }}>
      {/* Top Bar with Step counter and Exit button */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          padding: "0 4px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="pill pill-primary" style={{ fontSize: "0.85rem", padding: "4px 10px" }}>
            Step {stepNumber} of {totalSteps}
          </span>
          <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
            ({completedCount} completed)
          </span>
        </div>

        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onExit}
          title="Exit Blindfold Mode (Esc)"
          aria-label="Exit Blindfold Mode and see all tasks"
        >
          <CloseIcon style={{ width: 14, height: 14 }} />
          <span>Exit Blindfold (Esc)</span>
        </button>
      </div>

      {/* The Focused Single-Step Card */}
      <article
        className="blindfold-card"
        style={{
          background: "var(--surface)",
          border: "2px solid var(--forest)",
          borderRadius: 16,
          padding: "36px 32px",
          boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
          transition: "transform 0.2s ease, opacity 0.2s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--accent)", fontWeight: 700, fontSize: "0.85rem", marginBottom: 12, letterSpacing: "0.04em" }}>
          <span>FOCUS ON THIS STEP ONLY</span>
        </div>

        <h2 style={{ fontSize: "1.85rem", fontWeight: 800, margin: "0 0 14px", lineHeight: 1.3 }}>
          {task.title}
        </h2>

        <p style={{ fontSize: "1.1rem", color: "var(--foreground)", opacity: 0.85, margin: "0 0 20px", lineHeight: 1.6 }}>
          {task.description}
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.9rem", color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
            <ClockIcon style={{ width: 16, height: 16 }} />
            Estimated effort: {formatEffort(task.effortMin, task.effortMax)}
          </span>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setIsNoteOpen((prev) => !prev)}
            style={{ fontSize: "0.85rem" }}
          >
            <NoteIcon style={{ width: 14, height: 14 }} />
            {isNoteOpen ? "Hide scratchpad" : task.note ? "Edit note" : "+ Add scratch note"}
          </button>
        </div>

        {/* Scratchpad note area */}
        {isNoteOpen && (
          <BlindfoldNoteEditor
            key={task.id}
            taskId={task.id}
            initialNote={task.note || ""}
            onUpdateNote={onUpdateNote}
          />
        )}

        {/* Action Controls */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            borderTop: "1px solid var(--border)",
            paddingTop: 24,
          }}
        >
          <button
            type="button"
            className="btn btn-primary btn-lg"
            id="blindfold-complete-btn"
            onClick={() => onComplete(task.id)}
            title="Complete this task and reveal the next step (Cmd/Ctrl + Enter)"
          >
            <CheckIcon /> Mark Done & Reveal Next →
          </button>

          {totalSteps - completedCount > 1 && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={onSkip}
              title="Skip this step for now and focus on another"
            >
              Skip for now <ArrowRightIcon />
            </button>
          )}
        </div>
      </article>

      {/* Minimalist zen tip */}
      <div style={{ textAlign: "center", marginTop: 20, fontSize: "0.85rem", color: "var(--muted)" }}>
        <span>Tip: Press <strong>Cmd/Ctrl + Enter</strong> to mark complete, or <strong>Esc</strong> to view all tasks.</span>
      </div>
    </div>
  );
}

interface BlindfoldNoteEditorProps {
  taskId: string;
  initialNote: string;
  onUpdateNote: (taskId: string, note: string) => void;
}

function BlindfoldNoteEditor({
  taskId,
  initialNote,
  onUpdateNote,
}: BlindfoldNoteEditorProps) {
  const [noteValue, setNoteValue] = useState(initialNote);

  return (
    <div style={{ marginBottom: 24 }}>
      <textarea
        rows={3}
        className="input"
        placeholder="Quick thoughts, phone numbers, links, or draft messages for this step..."
        value={noteValue}
        onChange={(e) => {
          setNoteValue(e.target.value);
          onUpdateNote(taskId, e.target.value);
        }}
        style={{ width: "100%", fontSize: "0.9rem" }}
      />
    </div>
  );
}

