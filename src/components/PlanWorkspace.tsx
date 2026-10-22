"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useState,
  type FormEvent,
} from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  CloseIcon,
  DownloadIcon,
  FlagIcon,
  LockIcon,
  NoteIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  RotateIcon,
  SparkIcon,
  WarningIcon,
} from "@/components/Icons";
import {
  formatDeadlineRelative,
  formatEffort,
  formatWeeklyMinutes,
  generationModeLabel,
  planStatusLabel,
  pluralize,
  taskStatusLabel,
} from "@/lib/format";
import type { PlanDetail, TaskView } from "@/lib/plans";
import type { TaskStatus } from "@/lib/schemas";
import { NOTE_MAX_CHARS } from "@/lib/constants";

interface PlanWorkspaceProps {
  plan: PlanDetail;
  pendingRevision: {
    id: string;
    number: number;
    summary: string;
  } | null;
  welcome: boolean;
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

function sortTasks(tasks: TaskView[]): TaskView[] {
  return [...tasks].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt),
  );
}

export function PlanWorkspace({
  plan,
  pendingRevision,
  welcome,
}: PlanWorkspaceProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskView[]>(sortTasks(plan.tasks));
  const [startTaskId, setStartTaskId] = useState(plan.startTaskId);
  const [archived, setArchived] = useState(plan.status === "archived");
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [planBusy, setPlanBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(
    welcome
      ? "Plan approved. Everything below is now yours to edit, pause, or leave unfinished."
      : null,
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addForm, setAddForm] = useState({
    title: "",
    description: "",
    effortMin: "30",
    effortMax: "60",
  });

  const readOnly = archived;
  const sortedTasks = sortTasks(tasks);
  const doneTasks = sortedTasks.filter((task) => task.status === "done");
  const openTasks = sortedTasks.filter((task) => task.status !== "done");
  const doneIds = new Set(doneTasks.map((task) => task.id));
  const actionable = openTasks.filter(
    (task) =>
      task.status !== "blocked" &&
      task.dependsOn.every((dependency) => doneIds.has(dependency.id)),
  );
  const nextTask =
    (startTaskId
      ? actionable.find((task) => task.id === startTaskId)
      : undefined) ??
    actionable[0] ??
    null;
  const allDone = tasks.length > 0 && doneTasks.length === tasks.length;
  const effectiveStatus = archived
    ? "archived"
    : allDone
      ? "completed"
      : "active";
  const progressPercent =
    tasks.length === 0 ? 0 : Math.round((doneTasks.length / tasks.length) * 100);
  const waitingCount = openTasks.filter((task) =>
    task.dependsOn.some((dependency) => !doneIds.has(dependency.id)),
  ).length;
  const blockedCount = openTasks.filter((task) => task.status === "blocked").length;
  const startTask = tasks.find((task) => task.id === startTaskId) ?? null;

  function replaceTask(taskId: string, patch: Partial<TaskView>) {
    setTasks((current) => {
      const patched = current.map((task) =>
        task.id === taskId ? { ...task, ...patch } : task,
      );
      const byId = new Map(patched.map((task) => [task.id, task]));
      return patched.map((task) => {
        const dependsOn = task.dependsOn.map((dependency) => {
          const live = byId.get(dependency.id);
          return live
            ? { ...dependency, title: live.title, status: live.status }
            : dependency;
        });
        return {
          ...task,
          dependsOn,
          waitingOn: dependsOn
            .filter((dependency) => dependency.status !== "done")
            .map((dependency) => dependency.title),
        };
      });
    });
  }

  function applyStatus(taskId: string, status: TaskStatus) {
    replaceTask(taskId, {
      status,
      completedAt:
        status === "done" ? new Date().toISOString() : null,
    });
  }

  async function requestTaskPatch(
    taskId: string,
    patch: Record<string, unknown>,
  ): Promise<{ ok: boolean; message?: string }> {
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (response.status === 401) {
      router.push("/login");
      return { ok: false };
    }
    const data = (await response.json().catch(() => ({}))) as ApiFailure;
    if (!response.ok) {
      return {
        ok: false,
        message: apiMessage(data, "That task could not be updated."),
      };
    }
    return { ok: true };
  }

  async function changeStatus(taskId: string, status: TaskStatus) {
    if (readOnly || busyTaskId) return;
    const previous = tasks.find((task) => task.id === taskId);
    if (!previous) return;
    setError(null);
    setBusyTaskId(taskId);
    applyStatus(taskId, status);
    try {
      const result = await requestTaskPatch(taskId, { status });
      if (!result.ok) {
        replaceTask(taskId, {
          status: previous.status,
          completedAt: previous.completedAt,
        });
        if (result.message) setError(result.message);
      }
    } catch {
      replaceTask(taskId, {
        status: previous.status,
        completedAt: previous.completedAt,
      });
      setError("The connection failed. That status change was undone.");
    } finally {
      setBusyTaskId(null);
    }
  }

  async function saveTask(
    taskId: string,
    patch: Record<string, unknown>,
  ): Promise<boolean> {
    if (readOnly) return false;
    setError(null);
    setBusyTaskId(taskId);
    try {
      const result = await requestTaskPatch(taskId, patch);
      if (!result.ok) {
        if (result.message) setError(result.message);
        return false;
      }
      const next: Partial<TaskView> = {};
      if (typeof patch.title === "string") next.title = patch.title;
      if (typeof patch.description === "string") {
        next.description = patch.description;
      }
      if (patch.effortMin !== undefined) {
        next.effortMin = patch.effortMin as number | null;
      }
      if (patch.effortMax !== undefined) {
        next.effortMax = patch.effortMax as number | null;
      }
      if (patch.note !== undefined) next.note = (patch.note as string | null) ?? "";
      replaceTask(taskId, next);
      return true;
    } catch {
      setError("The connection failed. Those task changes were not saved.");
      return false;
    } finally {
      setBusyTaskId(null);
    }
  }

  async function deleteTask(taskId: string): Promise<boolean> {
    if (readOnly) return false;
    if (
      !window.confirm(
        "Remove this task from the plan? Its notes and dependency links will be removed too.",
      )
    ) {
      return false;
    }
    setError(null);
    setBusyTaskId(taskId);
    try {
      const response = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (response.status === 401) {
        router.push("/login");
        return false;
      }
      const data = (await response.json().catch(() => ({}))) as ApiFailure;
      if (!response.ok) {
        setError(apiMessage(data, "That task could not be removed."));
        return false;
      }
      setTasks((current) => {
        const remaining = current.filter((task) => task.id !== taskId);
        const byId = new Map(remaining.map((task) => [task.id, task]));
        return remaining.map((task) => {
          const dependsOn = task.dependsOn
            .filter((dependency) => dependency.id !== taskId)
            .map((dependency) => {
              const live = byId.get(dependency.id);
              return live
                ? { ...dependency, title: live.title, status: live.status }
                : dependency;
            });
          return {
            ...task,
            dependsOn,
            waitingOn: dependsOn
              .filter((dependency) => dependency.status !== "done")
              .map((dependency) => dependency.title),
          };
        });
      });
      if (startTaskId === taskId) {
        setStartTaskId(null);
      }
      return true;
    } catch {
      setError("The connection failed. That task is still in the plan.");
      return false;
    } finally {
      setBusyTaskId(null);
    }
  }

  async function chooseStart(taskId: string) {
    if (readOnly || planBusy || taskId === startTaskId) return;
    setError(null);
    setPlanBusy(true);
    try {
      const response = await fetch(`/api/plans/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startTaskId: taskId }),
      });
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      const data = (await response.json().catch(() => ({}))) as ApiFailure;
      if (!response.ok) {
        setError(apiMessage(data, "The start task could not be changed."));
        return;
      }
      setStartTaskId(taskId);
    } catch {
      setError("The connection failed. The start task was not changed.");
    } finally {
      setPlanBusy(false);
    }
  }

  async function moveTask(taskId: string, direction: -1 | 1) {
    if (readOnly || busyTaskId) return;
    const index = openTasks.findIndex((task) => task.id === taskId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= openTasks.length) return;
    const moving = openTasks[index];
    const neighbor = openTasks[target];
    if (!moving || !neighbor) return;
    const previous = tasks;
    setError(null);
    setBusyTaskId(taskId);
    setTasks((current) =>
      current.map((task) => {
        if (task.id === moving.id) return { ...task, sortOrder: neighbor.sortOrder };
        if (task.id === neighbor.id) return { ...task, sortOrder: moving.sortOrder };
        return task;
      }),
    );
    try {
      const [first, second] = await Promise.all([
        requestTaskPatch(moving.id, { sortOrder: neighbor.sortOrder }),
        requestTaskPatch(neighbor.id, { sortOrder: moving.sortOrder }),
      ]);
      if (!first.ok || !second.ok) {
        setTasks(previous);
        setError(first.message || second.message || "The tasks could not be reordered.");
      }
    } catch {
      setTasks(previous);
      setError("The connection failed. The task order was not changed.");
    } finally {
      setBusyTaskId(null);
    }
  }

  async function toggleArchive() {
    if (planBusy) return;
    setError(null);
    setPlanBusy(true);
    try {
      const response = await fetch(`/api/plans/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: archived ? "active" : "archived" }),
      });
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      const data = (await response.json().catch(() => ({}))) as ApiFailure;
      if (!response.ok) {
        setError(apiMessage(data, "That plan could not be updated."));
        return;
      }
      setArchived(!archived);
      setNotice(
        archived
          ? "Plan restored. You can edit the tasks again."
          : "Plan archived. It stays readable, but tasks are locked until you restore it.",
      );
      router.refresh();
    } catch {
      setError("The connection failed. The plan was not changed.");
    } finally {
      setPlanBusy(false);
    }
  }

  async function deletePlan() {
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/plans/${plan.id}`, { method: "DELETE" });
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      const data = (await response.json().catch(() => ({}))) as ApiFailure;
      if (!response.ok) {
        setError(apiMessage(data, "The plan could not be deleted."));
        setDeleteOpen(false);
        return;
      }
      router.push("/plans");
      router.refresh();
    } catch {
      setError("The connection failed. The plan was not deleted.");
      setDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (adding || readOnly) return;
    setAddError(null);
    const effortMin =
      addForm.effortMin.trim() === "" ? null : Number(addForm.effortMin);
    const effortMax =
      addForm.effortMax.trim() === "" ? null : Number(addForm.effortMax);
    if (addForm.title.trim().length < 3) {
      setAddError("Give the task a title of at least three characters.");
      return;
    }
    if (addForm.description.trim().length === 0) {
      setAddError("Add a short description of what done looks like.");
      return;
    }
    if (
      (effortMin !== null && (!Number.isInteger(effortMin) || effortMin < 5)) ||
      (effortMax !== null && (!Number.isInteger(effortMax) || effortMax < 5))
    ) {
      setAddError("Use whole minutes of 5 or more, or leave the effort blank.");
      return;
    }
    if (effortMin !== null && effortMax !== null && effortMin > effortMax) {
      setAddError("Maximum effort must be at least the minimum.");
      return;
    }
    setAdding(true);
    try {
      const response = await fetch(`/api/plans/${plan.id}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: addForm.title,
          description: addForm.description,
          effortMin,
          effortMax,
          note: null,
          dependsOn: [],
        }),
      });
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      const data = (await response.json().catch(() => ({}))) as ApiFailure & {
        taskId?: string;
        sortOrder?: number;
      };
      if (!response.ok || !data.taskId || data.sortOrder === undefined) {
        setAddError(apiMessage(data, "The task could not be added."));
        return;
      }
      const timestamp = new Date().toISOString();
      setTasks((current) => [
        ...current,
        {
          id: data.taskId!,
          title: addForm.title.trim(),
          description: addForm.description.trim(),
          effortMin,
          effortMax,
          status: "not_started",
          sortOrder: data.sortOrder!,
          rationale: null,
          note: "",
          createdAt: timestamp,
          updatedAt: timestamp,
          completedAt: null,
          dependsOn: [],
          waitingOn: [],
        },
      ]);
      setAddForm({
        title: "",
        description: "",
        effortMin: "30",
        effortMax: "60",
      });
      setAddOpen(false);
      setNotice("Task added to the plan.");
      router.refresh();
    } catch {
      setAddError("The connection failed. The task was not added.");
    } finally {
      setAdding(false);
    }
  }

  async function markDone(task: TaskView) {
    if (task.status === "done") return;
    await changeStatus(task.id, "done");
  }

  const planStatusTone =
    effectiveStatus === "completed"
      ? "pill-acid"
      : effectiveStatus === "archived"
        ? "pill"
        : "pill-forest";

  return (
    <>
      {notice ? (
        <div className="callout callout-info" role="status" style={{ marginBottom: 20 }}>
          <SparkIcon />
          <div style={{ flex: 1 }}>{notice}</div>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setNotice(null)}
            aria-label="Dismiss message"
          >
            <CloseIcon />
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="callout callout-danger" role="alert" style={{ marginBottom: 20 }}>
          <WarningIcon />
          <div>{error}</div>
        </div>
      ) : null}

      {pendingRevision ? (
        <div className="pending-revision-banner">
          <span>
            <strong>Preview #{pendingRevision.number} is waiting.</strong>{" "}
            {pendingRevision.summary}
          </span>
          <Link
            href={`/plans/${plan.id}/revise`}
            className="btn btn-acid btn-sm"
          >
            Review preview
            <ArrowRightIcon />
          </Link>
        </div>
      ) : null}

      {archived ? (
        <div className="callout callout-quiet" style={{ marginBottom: 20 }}>
          <PauseIcon />
          <div style={{ flex: 1 }}>
            <strong>This plan is archived.</strong> Its tasks and notes are
            read-only. Restore it to make changes or start a re-plan.
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={toggleArchive}
            disabled={planBusy}
          >
            <RotateIcon />
            Restore
          </button>
        </div>
      ) : null}

      <header className="plan-head">
        <div className="plan-head-main">
          <div className="row" style={{ gap: 10 }}>
            <span className={`pill ${planStatusTone}`}>
              {planStatusLabel(effectiveStatus)}
            </span>
            <span className="mono">{generationModeLabel(plan.generationMode)}</span>
          </div>
          <h1 className="plan-title">{plan.title}</h1>
          <p className="page-subtitle" style={{ fontSize: 14.5 }}>
            {plan.desiredOutcome}
          </p>
          <div className="plan-meta" style={{ marginTop: 14 }}>
            <span className="meta-chip">
              <CalendarIcon /> {formatDeadlineRelative(plan.horizonDate)}
            </span>
            <span className="meta-chip">
              <ClockIcon /> {formatWeeklyMinutes(plan.availableMinutesPerWeek)}
            </span>
            {startTask ? (
              <span className="meta-chip">
                <FlagIcon /> Start: {startTask.title}
              </span>
            ) : null}
          </div>
        </div>
        <div className="plan-toolbar">
          {!archived ? (
            <Link href={`/plans/${plan.id}/revise`} className="btn btn-primary">
              <RotateIcon />
              Re-plan
            </Link>
          ) : null}
          <button
            type="button"
            className="btn btn-outline"
            onClick={toggleArchive}
            disabled={planBusy}
          >
            <PauseIcon />
            {archived ? "Restore" : "Archive"}
          </button>
        </div>
      </header>

      <div className="overview-grid">
        {nextTask ? (
          <section className="next-action" aria-labelledby="next-action-title">
            <div className="next-action-label">
              <PlayIcon /> Next action
            </div>
            <h2 id="next-action-title">{nextTask.title}</h2>
            <p>{nextTask.description}</p>
            <div className="next-action-meta">
              <span>
                <ClockIcon /> {formatEffort(nextTask.effortMin, nextTask.effortMax)}
              </span>
              {nextTask.dependsOn.length > 0 ? (
                <span>
                  <CheckIcon /> {nextTask.dependsOn.length} prerequisite
                  {nextTask.dependsOn.length === 1 ? "" : "s"} done
                </span>
              ) : (
                <span>
                  <SparkIcon /> Ready to begin
                </span>
              )}
            </div>
            <div className="next-action-footer">
              {nextTask.status === "not_started" ? (
                <button
                  type="button"
                  className="btn btn-acid btn-sm"
                  onClick={() => changeStatus(nextTask.id, "in_progress")}
                  disabled={readOnly || Boolean(busyTaskId)}
                >
                  <PlayIcon />
                  Start it
                </button>
              ) : null}
              <button
                type="button"
                className={`btn btn-sm ${
                  nextTask.status === "in_progress" ? "btn-acid" : "btn-outline"
                }`}
                style={
                  nextTask.status === "in_progress"
                    ? undefined
                    : {
                        borderColor: "rgba(251,248,240,0.28)",
                        color: "var(--paper-bright)",
                      }
                }
                onClick={() => markDone(nextTask)}
                disabled={readOnly || Boolean(busyTaskId)}
              >
                <CheckIcon />
                Mark done
              </button>
              <a
                href={`#task-${nextTask.id}`}
                className="btn btn-ghost btn-sm"
                style={{ color: "rgba(251,248,240,0.72)" }}
              >
                Notes & details
              </a>
            </div>
          </section>
        ) : (
          <section
            className={`next-action ${allDone ? "next-complete" : ""}`}
            aria-labelledby="next-action-title"
          >
            <div className="next-action-label">
              {allDone ? <CheckIcon /> : <LockIcon />}
              {allDone ? "Plan complete" : "Nothing ready"}
            </div>
            <h2 id="next-action-title">
              {allDone
                ? "You finished the whole plan."
                : tasks.length === 0
                  ? "This plan has no tasks yet."
                  : "The next step is waiting on something else."}
            </h2>
            <p>
              {allDone
                ? "That is a real finish line. There is no streak to protect and nothing else to chase."
                : tasks.length === 0
                  ? "There is nothing to act on. Archive this plan and make a new one when you are ready."
                  : `${pluralize(waitingCount, "task")} ${
                      waitingCount === 1 ? "is" : "are"
                    } waiting on prerequisites. ${pluralize(
                      blockedCount,
                      "task",
                    )} ${blockedCount === 1 ? "is" : "are"} marked blocked.`}
            </p>
            <div className="next-action-footer">
              {allDone ? (
                <Link href="/compose" className="btn btn-acid btn-sm">
                  Make another plan
                  <ArrowRightIcon />
                </Link>
              ) : (
                <a
                  href="#tasks"
                  className="btn btn-outline btn-sm"
                  style={{
                    borderColor: "rgba(251,248,240,0.28)",
                    color: "var(--paper-bright)",
                  }}
                >
                  Review the tasks
                </a>
              )}
            </div>
          </section>
        )}

        <aside className="card progress-card" aria-label="Plan progress">
          <div>
            <div className="progress-big">
              {progressPercent}
              <span>%</span>
            </div>
            <p className="field-hint" style={{ marginTop: 8 }}>
              {doneTasks.length} of {tasks.length} tasks done. Progress is a
              count, not a judgement.
            </p>
          </div>
          <div className="progress" aria-hidden="true">
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
          <div className="progress-card-meta">
            <div className="progress-line">
              <span>Open tasks</span>
              <strong>{openTasks.length}</strong>
            </div>
            <div className="progress-line">
              <span>Waiting on others</span>
              <strong>{waitingCount}</strong>
            </div>
            <div className="progress-line">
              <span>Blocked</span>
              <strong>{blockedCount}</strong>
            </div>
          </div>
        </aside>
      </div>

      <div className="plan-body-grid">
        <section className="card task-board" id="tasks" aria-labelledby="tasks-title">
          <div className="task-board-head">
            <div>
              <h2 id="tasks-title">The steps</h2>
              <p>
                Set a status, add a private note, or edit the task. Changes save
                one task at a time.
              </p>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <span className="pill">
                {pluralize(tasks.length - doneTasks.length, "open task")}
              </span>
              {!readOnly ? (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    setAddError(null);
                    setAddOpen((open) => !open);
                  }}
                  disabled={tasks.length >= 20}
                  title={
                    tasks.length >= 20
                      ? "A plan can have at most 20 tasks"
                      : "Add a task"
                  }
                >
                  <PlusIcon />
                  Add a step
                </button>
              ) : null}
            </div>
          </div>

          {addOpen && !readOnly ? (
            <form
              className="task-inline-editor"
              onSubmit={addTask}
              style={{ margin: "16px 22px" }}
            >
              <div className="row-between">
                <strong style={{ fontSize: 12 }}>Add a step</strong>
                <span className="field-hint">It will be added as not started.</span>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="new-task-title">
                  Task title
                </label>
                <input
                  id="new-task-title"
                  className="input"
                  value={addForm.title}
                  onChange={(event) =>
                    setAddForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  maxLength={120}
                  required
                  minLength={3}
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="new-task-description">
                  Description
                </label>
                <textarea
                  id="new-task-description"
                  className="textarea"
                  value={addForm.description}
                  onChange={(event) =>
                    setAddForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  maxLength={600}
                  required
                  placeholder="What does done look like?"
                />
              </div>
              <div className="field">
                <span className="field-label">Rough effort (minutes)</span>
                <div className="effort-edit">
                  <input
                    className="input input-sm"
                    type="number"
                    inputMode="numeric"
                    min={5}
                    max={600}
                    step={5}
                    style={{ width: 78 }}
                    value={addForm.effortMin}
                    onChange={(event) =>
                      setAddForm((current) => ({
                        ...current,
                        effortMin: event.target.value,
                      }))
                    }
                    aria-label="Minimum effort in minutes"
                  />
                  <span className="effort-sep">to</span>
                  <input
                    className="input input-sm"
                    type="number"
                    inputMode="numeric"
                    min={5}
                    max={600}
                    step={5}
                    style={{ width: 78 }}
                    value={addForm.effortMax}
                    onChange={(event) =>
                      setAddForm((current) => ({
                        ...current,
                        effortMax: event.target.value,
                      }))
                    }
                    aria-label="Maximum effort in minutes"
                  />
                </div>
              </div>
              {addError ? (
                <p className="field-error" role="alert">
                  {addError}
                </p>
              ) : null}
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setAddOpen(false);
                    setAddError(null);
                  }}
                  disabled={adding}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={adding}
                >
                  {adding ? "Adding…" : "Add task"}
                </button>
              </div>
            </form>
          ) : null}

          {openTasks.length > 0 ? (
            <ol className="task-list">
              {openTasks.map((task) => {
                const openIndex = openTasks.findIndex((item) => item.id === task.id);
                return (
                  <TaskRow
                    key={task.id}
                    task={task}
                    isNext={nextTask?.id === task.id}
                    isStart={startTaskId === task.id}
                    busy={busyTaskId === task.id || planBusy}
                    readOnly={readOnly}
                    canMoveUp={openIndex > 0}
                    canMoveDown={openIndex < openTasks.length - 1}
                    onStatus={changeStatus}
                    onSave={saveTask}
                    onDelete={deleteTask}
                    onStart={chooseStart}
                    onMove={moveTask}
                  />
                );
              })}
            </ol>
          ) : tasks.length === 0 ? (
            <div className="empty-state">
              <h2>No tasks</h2>
              <p>This plan has no tasks to act on.</p>
            </div>
          ) : null}

          {doneTasks.length > 0 ? (
            <details className="done-section" open={doneTasks.length <= 4}>
              <summary className="done-summary">
                <span>
                  <CheckIcon />
                  {pluralize(doneTasks.length, "completed task")}
                </span>
                <ArrowDownIcon />
              </summary>
              <ol className="task-list">
                {doneTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    isNext={false}
                    isStart={startTaskId === task.id}
                    busy={busyTaskId === task.id || planBusy}
                    readOnly={readOnly}
                    canMoveUp={false}
                    canMoveDown={false}
                    onStatus={changeStatus}
                    onSave={saveTask}
                    onDelete={deleteTask}
                    onStart={chooseStart}
                    onMove={moveTask}
                  />
                ))}
              </ol>
            </details>
          ) : null}
        </section>

        <aside className="side-stack">
          <div className="card plan-side-card">
            <h3>
              <SparkIcon /> The bet in this plan
            </h3>
            <p>
              If these steps are taken, the outcome is more likely:{" "}
              <strong>{plan.desiredOutcome}</strong>
            </p>
            <div className="plan-side-meta">
              <div>
                <dt>Deadline</dt>
                <dd>{formatDeadlineRelative(plan.horizonDate)}</dd>
              </div>
              <div>
                <dt>Weekly time</dt>
                <dd>{formatWeeklyMinutes(plan.availableMinutesPerWeek)}</dd>
              </div>
              <div>
                <dt>Made with</dt>
                <dd>{generationModeLabel(plan.generationMode)}</dd>
              </div>
            </div>
          </div>

          {plan.assumptions.length > 0 ? (
            <div className="card plan-side-card">
              <h3>Assumptions still in play</h3>
              <ul className="assumption-list">
                {plan.assumptions.map((assumption) => (
                  <li key={assumption}>{assumption}</li>
                ))}
              </ul>
              <p className="field-hint" style={{ marginTop: 10 }}>
                Edit the tasks if any inference is wrong. A plan can be changed
                without starting over.
              </p>
            </div>
          ) : null}

          {plan.constraints ? (
            <div className="card plan-side-card">
              <h3>Constraints you set</h3>
              <p style={{ whiteSpace: "pre-line" }}>{plan.constraints}</p>
            </div>
          ) : null}

          <div className="card plan-side-card">
            <h3>Keep or leave</h3>
            <p>
              Export a readable copy while you still want it. Deletion removes the
              plan, tasks, notes, and any retained raw dump.
            </p>
            <div className="side-actions">
              <a
                href={`/api/plans/${plan.id}/export?format=md`}
                className="btn btn-outline btn-sm"
                download
              >
                <DownloadIcon />
                Export Markdown
              </a>
              <a
                href={`/api/plans/${plan.id}/export?format=txt`}
                className="btn btn-outline btn-sm"
                download
              >
                <DownloadIcon />
                Export plain text
              </a>
              {!archived ? (
                <Link
                  href={`/plans/${plan.id}/revise`}
                  className="btn btn-ghost btn-sm"
                >
                  <RotateIcon />
                  Preview a re-plan
                </Link>
              ) : null}
              <button
                type="button"
                className="danger-link"
                onClick={() => setDeleteOpen(true)}
                style={{ textAlign: "left", marginTop: 4 }}
              >
                Delete this plan
              </button>
            </div>
          </div>

          <div className="card plan-side-card">
            <h3>
              <LockIcon /> Data note
            </h3>
            <p>
              {plan.hasRawDump
                ? "The original brain dump is retained encrypted for up to 30 days, then automatically cleared. The plan and its tasks stay until you delete them."
                : "The original brain dump has been cleared. The plan and its tasks remain until you delete them."}
            </p>
            <Link href="/settings#data" className="field-hint" style={{ display: "inline-block", marginTop: 8 }}>
              Manage retained data
            </Link>
          </div>

          <Link href="/plans" className="btn btn-ghost btn-sm">
            <ArrowRightIcon style={{ transform: "rotate(180deg)" }} />
            All plans
          </Link>
        </aside>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete this plan?"
        description="This removes the plan, all of its tasks, notes, dependencies, and any retained raw dump. Export a copy first if you want to keep it. This cannot be undone."
        confirmLabel="Delete plan"
        tone="danger"
        busy={deleting}
        onConfirm={deletePlan}
        onCancel={() => setDeleteOpen(false)}
      />
    </>
  );
}

interface TaskRowProps {
  task: TaskView;
  isNext: boolean;
  isStart: boolean;
  busy: boolean;
  readOnly: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onStatus: (taskId: string, status: TaskStatus) => void;
  onSave: (taskId: string, patch: Record<string, unknown>) => Promise<boolean>;
  onDelete: (taskId: string) => Promise<boolean>;
  onStart: (taskId: string) => void;
  onMove: (taskId: string, direction: -1 | 1) => void;
}

function TaskRow({
  task,
  isNext,
  isStart,
  busy,
  readOnly,
  canMoveUp,
  canMoveDown,
  onStatus,
  onSave,
  onDelete,
  onStart,
  onMove,
}: TaskRowProps) {
  const [form, setForm] = useState({
    title: task.title,
    description: task.description,
    effortMin: task.effortMin === null ? "" : String(task.effortMin),
    effortMax: task.effortMax === null ? "" : String(task.effortMax),
    note: task.note,
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  function resetForm() {
    setForm({
      title: task.title,
      description: task.description,
      effortMin: task.effortMin === null ? "" : String(task.effortMin),
      effortMax: task.effortMax === null ? "" : String(task.effortMax),
      note: task.note,
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setFormError(null);
    const effortMin = form.effortMin.trim() === "" ? null : Number(form.effortMin);
    const effortMax = form.effortMax.trim() === "" ? null : Number(form.effortMax);
    if (
      (effortMin !== null && (!Number.isInteger(effortMin) || effortMin < 5)) ||
      (effortMax !== null && (!Number.isInteger(effortMax) || effortMax < 5))
    ) {
      setFormError("Use whole minutes of 5 or more, or leave the effort blank.");
      return;
    }
    if (effortMin !== null && effortMax !== null && effortMin > effortMax) {
      setFormError("Maximum effort must be at least the minimum.");
      return;
    }
    setSaving(true);
    const ok = await onSave(task.id, {
      title: form.title,
      description: form.description,
      effortMin,
      effortMax,
      note: form.note.trim() === "" ? null : form.note,
    });
    setSaving(false);
    if (ok) setDetailsOpen(false);
  }

  const waiting = task.dependsOn.filter(
    (dependency) => dependency.status !== "done",
  );

  return (
    <li
      id={`task-${task.id}`}
      className={`task-item ${isNext ? "is-next" : ""} ${
        task.status === "done" ? "is-done" : ""
      } ${waiting.length > 0 ? "is-waiting" : ""}`}
    >
      <div className="task-status-col">
        <label className="sr-only" htmlFor={`status-${task.id}`}>
          Status for {task.title}
        </label>
        <select
          id={`status-${task.id}`}
          className="status-select"
          data-status={task.status}
          value={task.status}
          onChange={(event) =>
            onStatus(task.id, event.target.value as TaskStatus)
          }
          disabled={readOnly || busy}
        >
          <option value="not_started">{taskStatusLabel("not_started")}</option>
          <option value="in_progress">{taskStatusLabel("in_progress")}</option>
          <option value="blocked">{taskStatusLabel("blocked")}</option>
          <option value="done">{taskStatusLabel("done")}</option>
        </select>
        <div className="row" style={{ gap: 5 }}>
          {isNext ? <span className="pill pill-acid">Next</span> : null}
          {isStart ? <span className="pill">Start here</span> : null}
          {waiting.length > 0 && task.status !== "done" ? (
            <span className="pill pill-warn">{waiting.length} waiting</span>
          ) : null}
        </div>
      </div>

      <div className="task-main">
        <div className="task-title-row">
          <span className="task-title">{task.title}</span>
        </div>
        <p className="task-desc">{task.description}</p>
        <div className="task-submeta">
          <span>
            <ClockIcon /> {formatEffort(task.effortMin, task.effortMax)}
          </span>
          {waiting.length > 0 ? (
            <span className="waiting-text">
              <LockIcon /> Waiting on:{" "}
              {waiting.map((dependency) => dependency.title).join(", ")}
            </span>
          ) : null}
          {task.note ? (
            <span>
              <NoteIcon /> Has a private note
            </span>
          ) : null}
          {task.rationale ? <span>Why: {task.rationale}</span> : null}
        </div>

        {task.note ? <div className="task-note-display">{task.note}</div> : null}

        {!readOnly ? (
          <details
            className="task-more"
            open={detailsOpen}
            onToggle={(event) => {
              if (event.currentTarget.open) resetForm();
              setDetailsOpen(event.currentTarget.open);
            }}
          >
            <summary>Details & notes</summary>
            <form className="task-inline-editor" onSubmit={submit}>
              <div className="field">
                <label className="field-label" htmlFor={`title-${task.id}`}>
                  Task title
                </label>
                <input
                  id={`title-${task.id}`}
                  className="input"
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, title: event.target.value }))
                  }
                  maxLength={120}
                  required
                  minLength={3}
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor={`desc-${task.id}`}>
                  Description
                </label>
                <textarea
                  id={`desc-${task.id}`}
                  className="textarea"
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  maxLength={600}
                  required
                />
              </div>
              <div className="field">
                <span className="field-label">Rough effort (minutes)</span>
                <div className="effort-edit">
                  <input
                    className="input input-sm"
                    type="number"
                    inputMode="numeric"
                    min={5}
                    max={600}
                    step={5}
                    style={{ width: 78 }}
                    value={form.effortMin}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        effortMin: event.target.value,
                      }))
                    }
                    aria-label="Minimum effort in minutes"
                  />
                  <span className="effort-sep">to</span>
                  <input
                    className="input input-sm"
                    type="number"
                    inputMode="numeric"
                    min={5}
                    max={600}
                    step={5}
                    style={{ width: 78 }}
                    value={form.effortMax}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        effortMax: event.target.value,
                      }))
                    }
                    aria-label="Maximum effort in minutes"
                  />
                </div>
              </div>
              <div className="field">
                <label className="field-label" htmlFor={`note-${task.id}`}>
                  Private note
                  <span className="optional">{form.note.length}/{NOTE_MAX_CHARS}</span>
                </label>
                <textarea
                  id={`note-${task.id}`}
                  className="textarea"
                  value={form.note}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, note: event.target.value }))
                  }
                  maxLength={NOTE_MAX_CHARS}
                  placeholder="Context, blockers, a link to where you left off…"
                />
              </div>
              {formError ? (
                <p className="field-error" role="alert">
                  {formError}
                </p>
              ) : null}
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={resetForm}
                  disabled={saving}
                >
                  Reset
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={saving || busy}
                >
                  {saving ? "Saving…" : "Save task"}
                </button>
              </div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <button
                  type="button"
                  className="danger-link"
                  onClick={async () => {
                    const removed = await onDelete(task.id);
                    if (removed) setDetailsOpen(false);
                  }}
                  disabled={saving || busy}
                >
                  Delete task
                </button>
                <span className="field-hint">Deletion is immediate.</span>
              </div>
            </form>
          </details>
        ) : null}

        {readOnly && task.note ? (
          <p className="field-hint" style={{ marginTop: 8 }}>
            Notes are read-only while the plan is archived.
          </p>
        ) : null}
      </div>

      <div className="task-actions-col">
        {!readOnly ? (
          <>
            <button
              type="button"
              className="icon-btn"
              onClick={() => onStart(task.id)}
              disabled={busy || isStart}
              aria-label={`Make "${task.title}" the start task`}
              title={isStart ? "Already the start task" : "Make this the start task"}
            >
              <FlagIcon />
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => onMove(task.id, -1)}
              disabled={busy || !canMoveUp}
              aria-label={`Move "${task.title}" up`}
            >
              <ArrowUpIcon />
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => onMove(task.id, 1)}
              disabled={busy || !canMoveDown}
              aria-label={`Move "${task.title}" down`}
            >
              <ArrowDownIcon />
            </button>
          </>
        ) : null}
      </div>
    </li>
  );
}
