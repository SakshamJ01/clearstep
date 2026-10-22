"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  RotateIcon,
  SparkIcon,
  WarningIcon,
} from "@/components/Icons";
import {
  formatDateHuman,
  formatDeadlineRelative,
  formatEffort,
  formatWeeklyMinutes,
  pluralize,
  taskStatusLabel,
} from "@/lib/format";
import type { PlanDetail } from "@/lib/plans";
import type { TaskStatus } from "@/lib/schemas";

export interface PendingReplanPreview {
  id: string;
  number: number;
  summary: string;
  changes: string[];
  taskOrder: string[];
  startTaskId: string | null;
  horizonDate: string | null;
  availableMinutesPerWeek: number | null;
  estimatedOpenMinutesMin: number;
  estimatedOpenMinutesMax: number;
  createdAt: string;
}

interface ReplanPanelProps {
  plan: PlanDetail;
  preview: PendingReplanPreview | null;
  today: string;
}

interface ApiFailure {
  error?: {
    code?: string;
    message?: string;
    fields?: Record<string, string>;
  };
}

function apiMessage(data: ApiFailure, fallback: string): string {
  const field = data.error?.fields ? Object.values(data.error.fields)[0] : null;
  return field || data.error?.message || fallback;
}

export function ReplanPanel({ plan, preview, today }: ReplanPanelProps) {
  const router = useRouter();
  const [horizonDate, setHorizonDate] = useState(preview?.horizonDate ?? plan.horizonDate ?? "");
  const [weekly, setWeekly] = useState(
    preview?.availableMinutesPerWeek !== null &&
      preview?.availableMinutesPerWeek !== undefined
      ? String(preview.availableMinutesPerWeek)
      : plan.availableMinutesPerWeek !== null
        ? String(plan.availableMinutesPerWeek)
        : "",
  );
  const [creating, setCreating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const archived = plan.status === "archived";

  const taskById = new Map(plan.tasks.map((task) => [task.id, task]));
  const beforeOpen = [...plan.tasks]
    .filter((task) => task.status !== "done")
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const afterOpen = preview
    ? preview.taskOrder
        .map((id) => taskById.get(id))
        .filter((task): task is PlanDetail["tasks"][number] => Boolean(task))
    : [];
  const beforeIndex = new Map(beforeOpen.map((task, index) => [task.id, index]));
  const completedCount = plan.tasks.length - beforeOpen.length;

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creating || archived) return;
    setError(null);
    const minutes = weekly.trim() === "" ? null : Number(weekly);
    if (
      minutes !== null &&
      (!Number.isInteger(minutes) || minutes < 30 || minutes > 10080)
    ) {
      setError("Weekly time must be a whole number between 30 and 10,080 minutes.");
      return;
    }
    if (horizonDate && horizonDate < today) {
      setError("The deadline must be today or later.");
      return;
    }
    setCreating(true);
    try {
      const response = await fetch(`/api/plans/${plan.id}/replan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          horizonDate: horizonDate || null,
          availableMinutesPerWeek: minutes,
        }),
      });
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      const data = (await response.json().catch(() => ({}))) as ApiFailure;
      if (!response.ok) {
        setError(apiMessage(data, "The preview could not be generated."));
        return;
      }
      router.refresh();
    } catch {
      setError("The connection failed. No preview was created.");
    } finally {
      setCreating(false);
    }
  }

  async function accept() {
    if (!preview || applying) return;
    setApplying(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/plans/${plan.id}/revisions/${preview.id}/accept`,
        { method: "POST" },
      );
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      const data = (await response.json().catch(() => ({}))) as ApiFailure;
      if (!response.ok) {
        setError(apiMessage(data, "The preview could not be applied."));
        return;
      }
      router.push(`/plans/${plan.id}`);
      router.refresh();
    } catch {
      setError("The connection failed. The plan was not changed.");
    } finally {
      setApplying(false);
    }
  }

  if (archived) {
    return (
      <div className="card empty-state">
        <h2>This plan is archived.</h2>
        <p>Restore it from the plan page before generating a new preview.</p>
        <Link href={`/plans/${plan.id}`} className="btn btn-primary">
          <ArrowLeftIcon />
          Back to plan
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="row" style={{ marginBottom: 18 }}>
        <Link href={`/plans/${plan.id}`} className="btn btn-ghost btn-sm">
          <ArrowLeftIcon />
          Back to plan
        </Link>
        <span className="pill">Preview only · nothing changes until you apply it</span>
      </div>

      {error ? (
        <div
          className="callout callout-danger"
          role="alert"
          style={{ marginBottom: 20 }}
        >
          <WarningIcon />
          <div>{error}</div>
        </div>
      ) : null}

      <div className="replan-layout">
        <section className="card replan-form-card">
          <h2>Change the frame</h2>
          <p>
            A re-plan never rewrites completed work. It only revisits the open
            tasks, their order, and the time you have.
          </p>
          <form onSubmit={generate} className="stack">
            <div className="field">
              <label className="field-label" htmlFor="replan-deadline">
                New deadline
                <span className="optional">Optional</span>
              </label>
              <input
                id="replan-deadline"
                className="input"
                type="date"
                min={today}
                value={horizonDate}
                onChange={(event) => setHorizonDate(event.target.value)}
              />
              <span className="field-hint">
                Currently {formatDeadlineRelative(plan.horizonDate).toLowerCase()}.
              </span>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="replan-weekly">
                Time available each week
                <span className="optional">Minutes</span>
              </label>
              <input
                id="replan-weekly"
                className="input"
                type="number"
                inputMode="numeric"
                min={30}
                max={10080}
                step={30}
                placeholder="No limit"
                value={weekly}
                onChange={(event) => setWeekly(event.target.value)}
              />
              <span className="field-hint">
                Currently {formatWeeklyMinutes(plan.availableMinutesPerWeek).toLowerCase()}.
              </span>
            </div>

            <div className="context-summary">
              <div className="progress-line">
                <span>Open tasks</span>
                <strong>{beforeOpen.length}</strong>
              </div>
              <div className="progress-line">
                <span>Completed, preserved</span>
                <strong>{completedCount}</strong>
              </div>
              <div className="progress-line">
                <span>Open effort</span>
                <strong>
                  {formatEffort(
                    beforeOpen.reduce((sum, task) => sum + (task.effortMin ?? 0), 0) ||
                      null,
                    beforeOpen.reduce((sum, task) => sum + (task.effortMax ?? 0), 0) ||
                      null,
                  )}
                </strong>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={creating}>
              <RotateIcon />
              {creating
                ? "Building preview…"
                : preview
                  ? "Generate fresh preview"
                  : "Preview re-plan"}
            </button>
            {preview ? (
              <p className="field-hint">
                Generating another preview replaces preview #{preview.number}.
                Nothing changes until you apply one.
              </p>
            ) : null}
          </form>
        </section>

        {preview ? (
          <div className="replan-preview">
            <section className="card preview-head-card">
              <div className="row-between" style={{ alignItems: "flex-start" }}>
                <div>
                  <div className="eyebrow">Preview #{preview.number}</div>
                  <h2>A proposed rearrangement</h2>
                </div>
                <span className="pill pill-warn">Not applied</span>
              </div>
              <p>{preview.summary}</p>
              <ul className="changes-list">
                {preview.changes.map((change, index) => (
                  <li key={change}>
                    <span className="change-num">{index + 1}</span>
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
              <div className="meta-row" style={{ marginTop: 16 }}>
                <span className="meta-chip">
                  <CalendarIcon /> {formatDateHuman(preview.horizonDate)}
                </span>
                <span className="meta-chip">
                  <ClockIcon />{" "}
                  {formatWeeklyMinutes(preview.availableMinutesPerWeek)}
                </span>
              </div>
            </section>

            <section aria-label="Task order comparison">
              <div className="compare-grid">
                <div className="compare-col">
                  <h3>
                    <span>Before</span>
                    <span>{pluralize(beforeOpen.length, "open task")}</span>
                  </h3>
                  {beforeOpen.length > 0 ? (
                    <ol className="order-list">
                      {beforeOpen.map((task) => (
                        <li
                          key={task.id}
                          className={`order-item ${
                            beforeIndex.get(task.id) !==
                            preview.taskOrder.indexOf(task.id)
                              ? "changed"
                              : ""
                          }`}
                        >
                          <span className="order-num">
                            {(beforeIndex.get(task.id) ?? 0) + 1}
                          </span>
                          <span className="order-title">{task.title}</span>
                          <span
                            className="status-pill"
                            data-status={task.status}
                          >
                            {taskStatusLabel(task.status as TaskStatus)}
                          </span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="field-hint">No open tasks.</p>
                  )}
                  {completedCount > 0 ? (
                    <p className="completed-note">
                      {pluralize(completedCount, "completed task")} preserved
                      exactly as {completedCount === 1 ? "it is" : "they are"}.
                    </p>
                  ) : null}
                </div>

                <div className="compare-col after">
                  <h3>
                    <span>After</span>
                    <span>Proposed order</span>
                  </h3>
                  {afterOpen.length > 0 ? (
                    <ol className="order-list">
                      {afterOpen.map((task, index) => (
                        <li
                          key={task.id}
                          className={`order-item ${
                            beforeIndex.get(task.id) !== index ? "changed" : ""
                          } ${preview.startTaskId === task.id ? "is-done" : ""}`}
                        >
                          <span className="order-num">{index + 1}</span>
                          <span className="order-title">{task.title}</span>
                          {preview.startTaskId === task.id ? (
                            <span className="pill pill-acid">Start</span>
                          ) : (
                            <span
                              className="status-pill"
                              data-status={task.status}
                            >
                              {taskStatusLabel(task.status as TaskStatus)}
                            </span>
                          )}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="field-hint">No open tasks to reorder.</p>
                  )}
                  {completedCount > 0 ? (
                    <p className="completed-note">
                      Completed tasks stay completed. Their notes and history do
                      not move.
                    </p>
                  ) : null}
                </div>
              </div>
            </section>

            <div className="preview-actions">
              <span className="pill pill-acid">
                <SparkIcon /> Preview ready
              </span>
              <span className="field-hint">
                Applying changes task order, the start task, deadline, and weekly
                time. It does not edit task text.
              </span>
              <span className="spacer" />
              <Link href={`/plans/${plan.id}`} className="btn btn-ghost">
                Leave it unapplied
              </Link>
              <button
                type="button"
                className="btn btn-primary"
                onClick={accept}
                disabled={applying}
              >
                <CheckIcon />
                {applying ? "Applying…" : "Apply this preview"}
              </button>
            </div>
          </div>
        ) : (
          <div className="card replan-empty empty-state">
            <h2>No preview yet.</h2>
            <p>
              Set a deadline or weekly time on the left, then generate a preview.
              The current plan stays exactly as it is.
            </p>
            <div className="row" style={{ justifyContent: "center" }}>
              <span className="pill">
                <CalendarIcon /> {formatDeadlineRelative(plan.horizonDate)}
              </span>
              <span className="pill">
                <ClockIcon />{" "}
                {formatWeeklyMinutes(plan.availableMinutesPerWeek)}
              </span>
              <span className="pill">
                {pluralize(beforeOpen.length, "open task")}
              </span>
            </div>
            <p className="field-hint" style={{ marginTop: 18 }}>
              Re-planning is deterministic. It uses task dependencies, effort,
              and status — not an AI provider.
            </p>
            <Link href={`/plans/${plan.id}`} className="btn btn-ghost">
              Return without changes
              <ArrowRightIcon />
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
