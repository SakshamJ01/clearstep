"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
  CheckIcon,
  FlagIcon,
  LockIcon,
  PlusIcon,
  RotateIcon,
  SparkIcon,
  TrashIcon,
  WarningIcon,
} from "@/components/Icons";
import {
  formatDateHuman,
  formatDateTime,
  formatWeeklyMinutes,
  generationModeLabel,
  pluralize,
} from "@/lib/format";
import type {
  AiPreference,
  DraftContent,
  DraftTask,
  GenerationMode,
} from "@/lib/schemas";

interface DraftEditorProps {
  draftId: string;
  content: DraftContent;
  outcome: string;
  horizonDate: string | null;
  availableMinutesPerWeek: number | null;
  constraints: string;
  aiConsent: boolean;
  mode: GenerationMode;
  fallbackReason: string | null;
  createdAt: string;
  aiAvailable: boolean;
  aiPreference: AiPreference;
}

interface ApiFailure {
  error?: {
    code?: string;
    message?: string;
    fields?: Record<string, string>;
  };
}

function newTaskId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function taskEffortTotal(tasks: DraftTask[]): { min: number; max: number } {
  return tasks.reduce(
    (total, task) => ({
      min: total.min + (task.effortMin ?? 0),
      max: total.max + (task.effortMax ?? 0),
    }),
    { min: 0, max: 0 },
  );
}

function contentReadyToSave(content: DraftContent): boolean {
  if (content.title.trim().length < 3 || content.summary.trim().length < 1) {
    return false;
  }
  return content.tasks.every(
    (task) =>
      task.title.trim().length >= 3 &&
      task.description.trim().length >= 1 &&
      (task.effortMin === null ||
        task.effortMax === null ||
        task.effortMin <= task.effortMax),
  );
}

export function DraftEditor({
  draftId,
  content: initialContent,
  outcome,
  horizonDate,
  availableMinutesPerWeek,
  constraints,
  aiConsent,
  mode: initialMode,
  fallbackReason,
  createdAt,
  aiAvailable,
  aiPreference,
}: DraftEditorProps) {
  const router = useRouter();
  const titleId = useId();
  const summaryId = useId();
  const [content, setContent] = useState<DraftContent>(initialContent);
  const [mode, setMode] = useState<GenerationMode>(initialMode);
  const [saveState, setSaveState] = useState<
    "saved" | "saving" | "unsaved" | "error"
  >("saved");
  const [approving, setApproving] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryNotice, setRetryNotice] = useState<string | null>(
    fallbackReason,
  );
  const [lastSaved, setLastSaved] = useState(JSON.stringify(initialContent));
  const approvingRef = useRef(false);

  useEffect(() => {
    const serialized = JSON.stringify(content);
    if (serialized === lastSaved || approvingRef.current) return;
    if (!contentReadyToSave(content)) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSaveState("saving");
      try {
        const response = await fetch(`/api/plans/drafts/${draftId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
          signal: controller.signal,
        });
        if (response.status === 401) {
          router.push("/login");
          return;
        }
        if (!response.ok) {
          setSaveState("error");
          return;
        }
        setLastSaved(serialized);
        setSaveState("saved");
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") {
          return;
        }
        setSaveState("error");
      }
    }, 850);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [content, draftId, lastSaved, router]);

  function updateContent(patch: Partial<DraftContent>) {
    setContent((current) => ({ ...current, ...patch }));
  }

  function updateTask(taskId: string, patch: Partial<DraftTask>) {
    setContent((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === taskId ? { ...task, ...patch } : task,
      ),
    }));
  }

  function moveTask(index: number, direction: -1 | 1) {
    setContent((current) => {
      const next = [...current.tasks];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return { ...current, tasks: next };
    });
  }

  function deleteTask(taskId: string) {
    if (content.tasks.length <= 3) {
      setError("A plan needs at least three tasks. Add a replacement first.");
      return;
    }
    if (
      !window.confirm(
        "Remove this task from the draft? You can add another one if you change your mind.",
      )
    ) {
      return;
    }
    setContent((current) => {
      const remaining = current.tasks
        .filter((task) => task.id !== taskId)
        .map((task) => ({
          ...task,
          dependsOn: task.dependsOn.filter((dependency) => dependency !== taskId),
        }));
      const startHereTaskId =
        current.startHereTaskId === taskId
          ? (remaining[0]?.id ?? null)
          : current.startHereTaskId;
      return { ...current, tasks: remaining, startHereTaskId };
    });
  }

  function addTask() {
    if (content.tasks.length >= 20) return;
    const id = newTaskId();
    setContent((current) => ({
      ...current,
      tasks: [
        ...current.tasks,
        {
          id,
          title: "New task",
          description: "Describe the action and what done looks like.",
          effortMin: 15,
          effortMax: 30,
          dependsOn: [],
          rationale: null,
          isAssumption: false,
        },
      ],
    }));
  }

  function taskTitle(taskId: string | null): string | null {
    if (!taskId) return null;
    return content.tasks.find((task) => task.id === taskId)?.title ?? null;
  }

  async function approve() {
    if (approving) return;
    if (content.tasks.length < 3) {
      setError("Keep at least three tasks before approving, or discard this draft.");
      return;
    }
    if (content.tasks.length > 20) {
      setError("Keep the plan to 20 tasks or fewer.");
      return;
    }
    if (!contentReadyToSave(content)) {
      setError(
        "Finish the title, summary, and task fields before approving. Each task title needs at least three characters.",
      );
      return;
    }
    setApproving(true);
    approvingRef.current = true;
    setError(null);
    try {
      const response = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId, content }),
      });
      const data = (await response.json().catch(() => ({}))) as ApiFailure & {
        planId?: string;
      };
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok || !data.planId) {
        const fieldError = data.error?.fields
          ? Object.values(data.error.fields)[0]
          : null;
        setError(
          fieldError ||
            data.error?.message ||
            "The plan could not be approved. Your draft is still here.",
        );
        setApproving(false);
        approvingRef.current = false;
        return;
      }
      router.push(`/plans/${data.planId}?welcome=1`);
      router.refresh();
    } catch {
      setError(
        "The connection failed while approving. Your draft is still here. Try again.",
      );
      setApproving(false);
      approvingRef.current = false;
    }
  }

  async function discard() {
    if (
      !window.confirm(
        "Discard this draft? The tasks will not be saved as a plan.",
      )
    ) {
      return;
    }
    setDiscarding(true);
    setError(null);
    try {
      const response = await fetch(`/api/plans/drafts/${draftId}`, {
        method: "DELETE",
      });
      if (!response.ok && response.status !== 404) {
        const data = (await response.json().catch(() => ({}))) as ApiFailure;
        setError(data.error?.message || "The draft could not be discarded.");
        return;
      }
      router.push("/compose");
      router.refresh();
    } catch {
      setError("The connection failed. The draft is still here.");
    } finally {
      setDiscarding(false);
    }
  }

  async function retryAi() {
    if (
      !window.confirm(
        "Retry with AI? This replaces the current draft, including any edits you have made here.",
      )
    ) {
      return;
    }
    setRetrying(true);
    setError(null);
    try {
      const response = await fetch(`/api/plans/drafts/${draftId}/retry-ai`, {
        method: "POST",
      });
      const data = (await response.json().catch(() => ({}))) as ApiFailure & {
        content?: DraftContent;
        mode?: GenerationMode;
        fallbackReason?: string | null;
      };
      if (!response.ok || !data.content) {
        setError(data.error?.message || "The AI retry could not finish.");
        return;
      }
      setLastSaved(JSON.stringify(data.content));
      setContent(data.content);
      setMode(data.mode ?? "ai");
      setRetryNotice(data.fallbackReason ?? null);
      setSaveState("saved");
    } catch {
      setError("The connection failed. The manual draft is still here.");
    } finally {
      setRetrying(false);
    }
  }

  const efforts = taskEffortTotal(content.tasks);
  const startTitle = taskTitle(content.startHereTaskId);
  const canRetryAi =
    mode === "manual_fallback" &&
    aiConsent &&
    aiAvailable &&
    aiPreference === "ask";
  const taskCountInvalid = content.tasks.length < 3 || content.tasks.length > 20;
  const contentDirty = JSON.stringify(content) !== lastSaved;
  const displaySaveState =
    !contentReadyToSave(content)
      ? "unsaved"
      : saveState === "error"
        ? "error"
        : contentDirty
          ? "saving"
          : "saved";
  const totalHours =
    efforts.max > 0
      ? `${Math.round((efforts.min / 60) * 10) / 10}–${
          Math.round((efforts.max / 60) * 10) / 10
        } hours`
      : "No estimate";

  return (
    <>
      <section className="page-header">
        <div className="eyebrow">Draft review</div>
        <h1 className="page-title">Read the seams before you approve.</h1>
        <p className="page-subtitle">
          Facts stay separate from inferences. Edit anything that is wrong, cut
          what does not belong, and choose the step you would actually start
          with. Nothing is active yet.
        </p>
      </section>

      <div className="row-between" style={{ marginBottom: 24 }}>
        <div className="meta-row">
          <span className="pill pill-neutral">
            {generationModeLabel(mode)}
          </span>
          <span className="meta-chip">
            <CheckIcon /> {pluralize(content.tasks.length, "task")}
          </span>
          <span className="meta-chip">
            <LockIcon /> Not saved as a plan
          </span>
          <span className="meta-chip">
            Drafted {formatDateTime(createdAt)}
          </span>
        </div>
        <div
          className="save-status"
          data-state={displaySaveState}
          aria-live="polite"
        >
          {displaySaveState === "saved"
            ? "Edits saved"
            : displaySaveState === "saving"
              ? "Saving edits…"
              : displaySaveState === "unsaved"
                ? "Finish this edit to save"
                : "Edits not saved to server"}
        </div>
      </div>

      {retryNotice ? (
        <div className="callout callout-warn" style={{ marginBottom: 20 }}>
          <WarningIcon />
          <div style={{ flex: 1 }}>
            <strong>This draft came from manual fallback.</strong>
            <p>{retryNotice}</p>
            {canRetryAi ? (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                style={{ marginTop: 10 }}
                onClick={retryAi}
                disabled={retrying}
              >
                <RotateIcon />
                {retrying ? "Retrying AI…" : "Retry with AI"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="callout callout-danger" role="alert" style={{ marginBottom: 20 }}>
          <WarningIcon />
          <div>{error}</div>
        </div>
      ) : null}

      {saveState === "error" ? (
        <div className="callout callout-quiet" style={{ marginBottom: 20 }}>
          <WarningIcon />
          <div>
            Autosave to the server is failing. Your latest edits are still in this
            tab, and approving will save the current version directly. Keep the
            tab open if you are not approving yet.
          </div>
        </div>
      ) : null}

      <div className="draft-layout">
        <div className="draft-main">
          <section className="card draft-section" aria-labelledby="draft-shape">
            <div className="draft-section-head">
              <div>
                <h2 id="draft-shape">The shape of it</h2>
                <p>Edit the title and summary, or leave the draft&apos;s wording.</p>
              </div>
            </div>

            <div className="field">
              <label className="sr-only" htmlFor={titleId}>
                Plan title
              </label>
              <input
                id={titleId}
                className="input draft-title-input"
                value={content.title}
                onChange={(event) => updateContent({ title: event.target.value })}
                maxLength={120}
              />
            </div>
            <div className="field">
              <label className="sr-only" htmlFor={summaryId}>
                Plan summary
              </label>
              <textarea
                id={summaryId}
                className="textarea draft-summary-textarea"
                value={content.summary}
                onChange={(event) => updateContent({ summary: event.target.value })}
                maxLength={600}
              />
            </div>

            <div className="meta-row" style={{ marginTop: 16 }}>
              <span className="meta-chip">
                Outcome: {outcome}
              </span>
              <span className="meta-chip">
                {formatDateHuman(horizonDate)}
              </span>
              <span className="meta-chip">
                {formatWeeklyMinutes(availableMinutesPerWeek)}
              </span>
            </div>
            {constraints ? (
              <p className="field-hint" style={{ marginTop: 10 }}>
                Constraints you gave: {constraints}
              </p>
            ) : null}

            <div className="insight-grid" style={{ marginTop: 22 }}>
              <div className="insight-panel">
                <h3>
                  <LockIcon /> You told us
                </h3>
                {content.statedFacts.length > 0 ? (
                  <ul className="plain-list">
                    {content.statedFacts.map((fact) => (
                      <li key={fact}>{fact}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="insight-empty">
                    No separate facts were recorded. The context above is still
                    yours.
                  </p>
                )}
              </div>
              <div className="insight-panel inferred">
                <h3>
                  <SparkIcon /> We inferred
                </h3>
                {content.assumptions.length > 0 ? (
                  <ul className="plain-list">
                    {content.assumptions.map((assumption) => (
                      <li key={assumption}>{assumption}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="insight-empty">No assumptions were flagged.</p>
                )}
              </div>
            </div>

            {content.clarifyingQuestion ? (
              <div className="question-card">
                <SparkIcon />
                <div>
                  <span className="question-label">One question that may matter</span>
                  <p>{content.clarifyingQuestion}</p>
                  <p className="small" style={{ marginTop: 5, opacity: 0.8 }}>
                    You do not have to answer it. Edit the tasks if you already know
                    better, or approve with the assumptions visible above.
                  </p>
                </div>
              </div>
            ) : null}
          </section>

          <section className="card draft-section" aria-labelledby="draft-tasks">
            <div className="draft-section-head">
              <div>
                <h2 id="draft-tasks">The steps</h2>
                <p>
                  Reorder, rewrite, cut, or add. Choose one task to start with.
                </p>
              </div>
              <span className="pill">{pluralize(content.tasks.length, "task")}</span>
            </div>

            <ol className="task-edit-list">
              {content.tasks.map((task, index) => {
                const dependencies = task.dependsOn
                  .map((dependency) =>
                    content.tasks.find((item) => item.id === dependency),
                  )
                  .filter((item): item is DraftTask => Boolean(item));
                const isStart = content.startHereTaskId === task.id;
                const titleFieldId = `${task.id}-title-${index}`;
                const descriptionFieldId = `${task.id}-desc-${index}`;
                return (
                  <li
                    key={task.id}
                    className={`task-edit-card ${isStart ? "is-start" : ""}`}
                  >
                    <div className="task-edit-head">
                      <div className="task-edit-head-left">
                        <span className="task-index" aria-hidden="true">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        {isStart ? (
                          <span className="pill pill-acid">
                            <FlagIcon /> Start here
                          </span>
                        ) : null}
                        {task.isAssumption ? (
                          <span className="pill pill-warn">Inferred</span>
                        ) : null}
                      </div>
                      <div className="task-tools">
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => updateContent({ startHereTaskId: task.id })}
                          aria-label={`Make "${task.title}" the start here task`}
                          title="Make this start here"
                          disabled={isStart}
                        >
                          <FlagIcon />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => moveTask(index, -1)}
                          aria-label={`Move "${task.title}" up`}
                          disabled={index === 0}
                        >
                          <ArrowUpIcon />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => moveTask(index, 1)}
                          aria-label={`Move "${task.title}" down`}
                          disabled={index === content.tasks.length - 1}
                        >
                          <ArrowDownIcon />
                        </button>
                        <button
                          type="button"
                          className="icon-btn danger"
                          onClick={() => deleteTask(task.id)}
                          aria-label={`Remove "${task.title}"`}
                          title={
                            content.tasks.length <= 3
                              ? "A plan needs at least three tasks"
                              : "Remove task"
                          }
                          disabled={content.tasks.length <= 3}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>

                    <div className="task-edit-fields">
                      <div className="field">
                        <label className="sr-only" htmlFor={titleFieldId}>
                          Task {index + 1} title
                        </label>
                        <input
                          id={titleFieldId}
                          className="input task-title-input"
                          value={task.title}
                          onChange={(event) =>
                            updateTask(task.id, { title: event.target.value })
                          }
                          maxLength={120}
                          aria-label={`Task ${index + 1} title`}
                        />
                      </div>
                      <div className="field">
                        <label className="sr-only" htmlFor={descriptionFieldId}>
                          Task {index + 1} description
                        </label>
                        <textarea
                          id={descriptionFieldId}
                          className="textarea task-desc-input"
                          value={task.description}
                          onChange={(event) =>
                            updateTask(task.id, { description: event.target.value })
                          }
                          maxLength={600}
                          aria-label={`Task ${index + 1} description`}
                        />
                      </div>
                      <div className="task-meta-edit">
                        <div className="row" style={{ gap: 8 }}>
                          <span className="mono-label">Effort</span>
                          <div className="effort-edit">
                            <input
                              className="input input-sm"
                              type="number"
                              inputMode="numeric"
                              min={5}
                              max={600}
                              step={5}
                              style={{ width: 62 }}
                              value={task.effortMin ?? ""}
                              onChange={(event) =>
                                updateTask(task.id, {
                                  effortMin: event.target.value
                                    ? Number(event.target.value)
                                    : null,
                                })
                              }
                              aria-label={`Task ${index + 1} minimum minutes`}
                            />
                            <span className="effort-sep">to</span>
                            <input
                              className="input input-sm"
                              type="number"
                              inputMode="numeric"
                              min={5}
                              max={600}
                              step={5}
                              style={{ width: 62 }}
                              value={task.effortMax ?? ""}
                              onChange={(event) =>
                                updateTask(task.id, {
                                  effortMax: event.target.value
                                    ? Number(event.target.value)
                                    : null,
                                })
                              }
                              aria-label={`Task ${index + 1} maximum minutes`}
                            />
                            <span className="effort-sep">min</span>
                          </div>
                        </div>
                        <div>
                          {dependencies.length > 0 ? (
                            <div className="dependency-line">
                              After:
                              {dependencies.map((dependency) => (
                                <span key={dependency.id} className="dep-chip">
                                  {dependency.title}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="field-hint">No dependency</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {task.rationale ? (
                      <p className="rationale-line">Why: {task.rationale}</p>
                    ) : null}
                  </li>
                );
              })}
            </ol>

            <button
              type="button"
              className="btn btn-outline new-task-btn"
              onClick={addTask}
              disabled={content.tasks.length >= 20}
            >
              <PlusIcon />
              {content.tasks.length >= 20
                ? "20-task limit reached"
                : "Add a task"}
            </button>
          </section>

          <div className="draft-footnote">
            <LockIcon />
            <span>
              Model output is treated as untrusted text: the server validates it,
              caps every field, removes broken dependency links, and renders
              everything as plain text. Links and actions inside a draft are never
              executed.
            </span>
          </div>
        </div>

        <aside className="draft-sidebar" aria-label="Approve plan">
          <div className="card review-card">
            <h3>Ready to make it real?</h3>
            <ul className="review-checks">
              <li>
                <CheckIcon /> The task list is mine, not just the model&apos;s.
              </li>
              <li>
                <CheckIcon /> I checked the inferred assumptions above.
              </li>
              <li>
                <CheckIcon /> I chose a first step I can actually begin.
              </li>
            </ul>

            <div className="review-stats">
              <div className="review-stat">
                <span>Tasks</span>
                <strong>{content.tasks.length} / 20</strong>
              </div>
              <div className="review-stat">
                <span>Rough effort</span>
                <strong>{totalHours}</strong>
              </div>
              <div className="review-stat">
                <span>Start here</span>
                <strong style={{ fontSize: 11.5 }}>
                  {startTitle || "Choose a task"}
                </strong>
              </div>
              <div className="review-stat">
                <span>Horizon</span>
                <strong style={{ fontSize: 11.5 }}>
                  {formatDateHuman(horizonDate)}
                </strong>
              </div>
            </div>

            {taskCountInvalid ? (
              <div className="callout callout-warn" style={{ marginBottom: 12 }}>
                <WarningIcon />
                <div>
                  A plan needs between 3 and 20 tasks. You currently have{" "}
                  {content.tasks.length}.
                </div>
              </div>
            ) : null}

            <div className="review-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={approve}
                disabled={approving || taskCountInvalid || discarding}
              >
                {approving ? "Approving plan…" : "Approve plan"}
                {!approving ? <CheckIcon /> : null}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={discard}
                disabled={discarding || approving}
              >
                <TrashIcon />
                {discarding ? "Discarding…" : "Discard draft"}
              </button>
            </div>
            <p className="approve-note">
              Approving saves these tasks as an active plan. The raw dump is
              encrypted at rest, kept for no longer than 30 days, and can be
              deleted sooner.
            </p>
          </div>

          <div className="card draft-footnote" style={{ background: "var(--paper-deep)" }}>
            <ArrowLeftIcon />
            <span>
              Want to change the deadline or time available? You can do that after
              approval in the re-plan preview, without losing completed work.
            </span>
          </div>

          <Link href="/compose" className="btn btn-ghost btn-sm">
            <ArrowLeftIcon />
            Back to composer
          </Link>
        </aside>
      </div>
    </>
  );
}
