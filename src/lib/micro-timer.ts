export type SprintStatus = "idle" | "running" | "paused" | "finished";

export interface SprintPreset {
  minutes: number;
  label: string;
  description: string;
}

export const SPRINT_PRESETS: SprintPreset[] = [
  { minutes: 5, label: "5 min", description: "Anti-procrastination starter" },
  { minutes: 10, label: "10 min", description: "Focused momentum push" },
  { minutes: 15, label: "15 min", description: "Deep power sprint" },
];

/**
 * Formats a remaining number of seconds into "MM:SS" (e.g. 300 -> "05:00").
 */
export function formatTimerSeconds(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  const paddedMins = mins < 10 ? `0${mins}` : `${mins}`;
  const paddedSecs = secs < 10 ? `0${secs}` : `${secs}`;
  return `${paddedMins}:${paddedSecs}`;
}

/**
 * Calculates progress percentage from total seconds and remaining seconds.
 */
export function calculateProgressPercent(totalSeconds: number, remainingSeconds: number): number {
  if (totalSeconds <= 0) return 100;
  const elapsed = totalSeconds - Math.max(0, remainingSeconds);
  const percent = Math.round((elapsed / totalSeconds) * 100);
  return Math.min(100, Math.max(0, percent));
}
