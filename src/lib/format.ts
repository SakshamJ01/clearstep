import type { GenerationMode, PlanStatus, TaskStatus } from "@/lib/schemas";

export function taskStatusLabel(status: TaskStatus): string {
  switch (status) {
    case "not_started":
      return "Not started";
    case "in_progress":
      return "In progress";
    case "done":
      return "Done";
    case "blocked":
      return "Blocked";
  }
}

export function planStatusLabel(status: PlanStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "active":
      return "Active";
    case "completed":
      return "Completed";
    case "archived":
      return "Archived";
  }
}

export function generationModeLabel(mode: GenerationMode): string {
  switch (mode) {
    case "ai":
      return "AI-assisted draft";
    case "manual":
      return "Manual draft";
    case "manual_fallback":
      return "Manual fallback";
  }
}

export function formatEffort(
  min: number | null,
  max: number | null,
): string {
  if (min !== null && max !== null) return `${min}–${max} min`;
  if (min !== null) return `${min}+ min`;
  if (max !== null) return `Up to ${max} min`;
  return "No estimate";
}

export function formatDateHuman(value: string | null | undefined): string {
  if (!value) return "No deadline";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatDeadlineRelative(value: string | null): string {
  if (!value) return "No deadline";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const deadline = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  const now = new Date();
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const days = Math.round((deadline - today) / (24 * 60 * 60 * 1000));
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days === -1) return "1 day overdue";
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days < 14) return `${days} days left`;
  return formatDateHuman(value);
}

export function formatWeeklyMinutes(minutes: number | null): string {
  if (!minutes) return "No weekly limit";
  if (minutes < 60) return `${minutes} min / week`;
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${hours} ${hours === 1 ? "hour" : "hours"} / week`;
}

export function pluralize(
  count: number,
  singular: string,
  plural = `${singular}s`,
): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
