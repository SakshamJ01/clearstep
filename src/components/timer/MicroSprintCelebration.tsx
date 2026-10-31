"use client";

import { CheckIcon, PlusIcon, SparkIcon } from "@/components/Icons";

interface MicroSprintCelebrationProps {
  taskId: string;
  onCompleteTask: (id: string) => void;
  onExtend: (mins: number) => void;
  onClose: () => void;
}

export function MicroSprintCelebration({
  taskId,
  onCompleteTask,
  onExtend,
  onClose,
}: MicroSprintCelebrationProps) {
  return (
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
            onCompleteTask(taskId);
            onClose();
          }}
        >
          <CheckIcon /> Mark Step as Done!
        </button>
        <button
          type="button"
          className="btn btn-outline"
          id="micro-sprint-extend-btn"
          onClick={() => onExtend(5)}
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
  );
}
