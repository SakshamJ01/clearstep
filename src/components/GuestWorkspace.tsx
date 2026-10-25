"use client";

import Link from "next/link";
import { useId, useState, useSyncExternalStore, type DragEvent, type FormEvent } from "react";
import {
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  CheckIcon,
  ClockIcon,
  DownloadIcon,
  FlagIcon,
  NoteIcon,
  PlusIcon,
  RotateIcon,
  SparkIcon,
  TrashIcon,
} from "@/components/Icons";
import { VoiceInputButton } from "@/components/VoiceInputButton";
import { formatEffort, pluralize } from "@/lib/format";
import { formatSpokenChunk } from "@/lib/use-voice-dictation";
import {
  clearGuestPlan,
  createGuestPlanFromDraft,
  getGuestPlanSnapshot,
  guestPlanSchema,
  loadGuestPlan,
  saveGuestPlan,
  subscribeGuestPlan,
  type GuestPlan,
  type GuestTask,
} from "@/lib/guest-storage";
import { buildManualDraft } from "@/lib/planner/manual";

const PRESETS = [
  {
    label: "🧹 Clear my life admin",
    outcome: "Get all overdue life admin sorted",
    dump: `renew passport before the trip, I keep forgetting
ask Sam about splitting the rent
check dentist availability for a check-up
cancel subscription I don't use anymore
sort pile of mail on the desk`,
  },
  {
    label: "💼 Job interview prep",
    outcome: "Be confident and ready for the technical interview",
    dump: `review system design fundamentals
practice two mock behavioral stories using STAR method
polish my resume experience section
prepare 3 thoughtful questions to ask the interviewer
test webcam, mic, and quiet setup`,
  },
  {
    label: "📦 Declutter my room",
    outcome: "Clean, spacious bedroom by tonight",
    dump: `collect all clothes off the floor and chair
bag up clothes that don't fit for donation
strip bed sheets and start a wash cycle
wipe down desk and organize charging cables
take out recycling and trash bin`,
  },
  {
    label: "🚀 Launch side project",
    outcome: "Ship v1 MVP to early testers",
    dump: `test the user registration and login flow
write README with local setup instructions
deploy latest commit to production hosting
draft launch announcement post
share demo link with 3 developer friends for feedback`,
  },
];

export function GuestWorkspace() {
  const dumpId = useId();
  const outcomeId = useId();

  const guestPlan = useSyncExternalStore(
    subscribeGuestPlan,
    getGuestPlanSnapshot,
    () => null,
  );

  const [isEditingDump, setIsEditingDump] = useState(false);

  const mode =
    isEditingDump || !guestPlan
      ? "composer"
      : guestPlan.status === "active"
        ? "workspace"
        : "review";

  // Composer fields
  const [dump, setDump] = useState("");
  const [outcome, setOutcome] = useState("");
  const [composerError, setComposerError] = useState<string | null>(null);

  // Drag and drop state
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);

  // Task editing / notes state
  const [openNoteTaskId, setOpenNoteTaskId] = useState<string | null>(null);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);

  function handleUsePreset(preset: (typeof PRESETS)[0]) {
    setOutcome(preset.outcome);
    setDump(preset.dump);
    setComposerError(null);
  }

  function handleGenerateDraft(e: FormEvent) {
    e.preventDefault();
    setComposerError(null);

    const cleanDump = dump.trim();
    if (cleanDump.length < 15) {
      setComposerError("Write or paste a little more so we have steps to work with (at least a couple of sentences).");
      return;
    }

    const cleanOutcome = outcome.trim() || "Clear my head and take action";

    const draftContent = buildManualDraft({
      dump: cleanDump,
      outcome: cleanOutcome,
      horizonDate: null,
      availableMinutesPerWeek: null,
      constraints: null,
    });

    const newPlan = createGuestPlanFromDraft({
      dump: cleanDump,
      outcome: cleanOutcome,
      content: draftContent,
      status: "draft",
    });

    saveGuestPlan(newPlan);
    setIsEditingDump(false);
  }

  function handleActivatePlan() {
    if (!guestPlan) return;
    const activated: GuestPlan = {
      ...guestPlan,
      status: "active",
      updatedAt: new Date().toISOString(),
    };
    saveGuestPlan(activated);
  }

  function handleEditDump() {
    if (guestPlan) {
      setDump(guestPlan.sourceDump || "");
      setOutcome(guestPlan.desiredOutcome || "");
    }
    setIsEditingDump(true);
  }

  function handleToggleTask(taskId: string) {
    if (!guestPlan) return;
    const now = new Date().toISOString();
    const updatedTasks: GuestTask[] = guestPlan.tasks.map((task) => {
      if (task.id !== taskId) return task;
      const isDone = task.status === "done";
      return {
        ...task,
        status: isDone ? "not_started" : "done",
        completedAt: isDone ? null : now,
      };
    });

    saveGuestPlan({
      ...guestPlan,
      tasks: updatedTasks,
    });
  }

  function handleUpdateNote(taskId: string, noteText: string) {
    if (!guestPlan) return;
    const updatedTasks = guestPlan.tasks.map((task) => {
      if (task.id !== taskId) return task;
      return { ...task, note: noteText };
    });
    saveGuestPlan({
      ...guestPlan,
      tasks: updatedTasks,
    });
  }

  function handleMoveTask(fromIndex: number, toIndex: number) {
    if (!guestPlan) return;
    if (toIndex < 0 || toIndex >= guestPlan.tasks.length) return;

    const list = [...guestPlan.tasks];
    const [moved] = list.splice(fromIndex, 1);
    if (!moved) return;
    list.splice(toIndex, 0, moved);

    const reordered = list.map((item, idx) => ({
      ...item,
      sortOrder: (idx + 1) * 10,
    }));

    saveGuestPlan({
      ...guestPlan,
      tasks: reordered,
    });
  }

  function handleDragStart(taskId: string) {
    setDraggingTaskId(taskId);
  }

  function handleDragOver(e: DragEvent<HTMLLIElement>, taskId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverTaskId !== taskId) {
      setDragOverTaskId(taskId);
    }
  }

  function handleDrop(e: DragEvent<HTMLLIElement>, targetTaskId: string) {
    e.preventDefault();
    if (!guestPlan || !draggingTaskId || draggingTaskId === targetTaskId) {
      setDraggingTaskId(null);
      setDragOverTaskId(null);
      return;
    }

    const fromIndex = guestPlan.tasks.findIndex((t) => t.id === draggingTaskId);
    const toIndex = guestPlan.tasks.findIndex((t) => t.id === targetTaskId);

    if (fromIndex !== -1 && toIndex !== -1) {
      handleMoveTask(fromIndex, toIndex);
    }

    setDraggingTaskId(null);
    setDragOverTaskId(null);
  }

  function handleDeleteTask(taskId: string) {
    if (!guestPlan || guestPlan.tasks.length <= 1) return;
    const remaining = guestPlan.tasks.filter((t) => t.id !== taskId);
    saveGuestPlan({
      ...guestPlan,
      tasks: remaining,
      startTaskId:
        guestPlan.startTaskId === taskId
          ? remaining[0]?.id ?? null
          : guestPlan.startTaskId,
    });
  }

  function handleSetStartTask(taskId: string) {
    if (!guestPlan) return;
    saveGuestPlan({
      ...guestPlan,
      startTaskId: taskId,
    });
  }

  function handleReset() {
    if (typeof window !== "undefined" && window.confirm("Start fresh? This will clear this guest draft.")) {
      clearGuestPlan();
      setIsEditingDump(false);
      setDump("");
      setOutcome("");
    }
  }

  function handleCopyMarkdown() {
    if (!guestPlan) return;
    const lines = [
      `# ${guestPlan.title}`,
      `**Outcome**: ${guestPlan.desiredOutcome}`,
      "",
      "## Action Steps",
      ...guestPlan.tasks.map((t, idx) => {
        const check = t.status === "done" ? "[x]" : "[ ]";
        const isStart = t.id === guestPlan.startTaskId ? " *(Start Here)*" : "";
        const note = t.note ? `\n   > Note: ${t.note}` : "";
        return `${idx + 1}. ${check} **${t.title}**${isStart} (${formatEffort(t.effortMin, t.effortMax)})${note}\n   ${t.description}`;
      }),
      "",
      "---",
      "*Generated with Clearstep Instant Guest Mode*",
    ];

    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopyNotice("Plan copied to clipboard as Markdown!");
      setTimeout(() => setCopyNotice(null), 3000);
    });
  }

  function handleDownloadTxt() {
    if (!guestPlan) return;
    const lines = [
      `${guestPlan.title.toUpperCase()}`,
      `Outcome: ${guestPlan.desiredOutcome}`,
      `Date: ${new Date().toLocaleDateString()}`,
      "------------------------------------------",
      "",
      ...guestPlan.tasks.map((t, idx) => {
        const status = t.status === "done" ? "[DONE]" : "[TODO]";
        const isStart = t.id === guestPlan.startTaskId ? " [START HERE]" : "";
        return `${idx + 1}. ${status}${isStart} ${t.title}\n   ${t.description}\n`;
      }),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${guestPlan.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-plan.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Derived progress stats
  const totalTasks = guestPlan?.tasks.length ?? 0;
  const doneTasks = guestPlan?.tasks.filter((t) => t.status === "done").length ?? 0;
  const progressPercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const startTask = guestPlan?.tasks.find((t) => t.id === guestPlan.startTaskId) || guestPlan?.tasks[0];

  return (
    <div className="guest-container" style={{ maxWidth: 840, margin: "0 auto", padding: "24px 16px" }}>
      {/* Soft conversion banner visible during review or workspace */}
      {mode !== "composer" && (
        <div
          className="callout callout-info"
          style={{
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            borderLeft: "4px solid var(--accent)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <SparkIcon />
            <div>
              <strong>Guest Sandbox:</strong> Your plan is saved safely in this browser.
              <span className="hide-sm" style={{ opacity: 0.85, marginLeft: 6 }}>
                Create a free account to sync across devices.
              </span>
            </div>
          </div>
          <Link href="/signup?claim=true" className="btn btn-primary btn-sm" id="guest-save-account-btn">
            Save this plan
            <ArrowRightIcon />
          </Link>
        </div>
      )}

      {/* COMPOSER VIEW */}
      {mode === "composer" && (
        <section className="composer-card">
          <div className="eyebrow" style={{ color: "var(--accent)", marginBottom: 8 }}>
            Zero-Signup Instant Pilot
          </div>
          <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 12 }}>
            Dump the noise. Leave with a first step.
          </h1>
          <p style={{ color: "var(--muted)", marginBottom: 24, fontSize: "1.05rem" }}>
            Nothing here touches a server until you want it to. Type your unfiltered thoughts below, or pick a sample prompt to see how Clearstep cuts through overwhelm.
          </p>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--muted)", marginBottom: 8 }}>
              Try an instant example:
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => handleUsePreset(preset)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleGenerateDraft}>
            <div className="field" style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
                <label className="field-label" htmlFor={dumpId} style={{ marginBottom: 0 }}>
                  The Brain Dump <span style={{ color: "var(--accent)" }}>*</span>
                </label>
                <VoiceInputButton
                  onTranscriptChunk={(chunk) => {
                    setDump((prev) => formatSpokenChunk(prev, chunk));
                  }}
                />
              </div>
              <textarea
                id={dumpId}
                className="input"
                rows={7}
                placeholder="Write, speak, or paste whatever is in your head: unfinished chores, messy ideas, things you're anxious about avoiding..."
                value={dump}
                onChange={(e) => setDump(e.target.value)}
                required
              />
              <div className="field-hint" style={{ marginTop: 4 }}>
                {dump.split(/\s+/).filter(Boolean).length} words · Speak out loud or separate items with line breaks.
              </div>
            </div>

            <div className="field" style={{ marginBottom: 24 }}>
              <label className="field-label" htmlFor={outcomeId}>
                Desired Outcome (Optional)
              </label>
              <input
                id={outcomeId}
                type="text"
                className="input"
                placeholder="e.g. Get through this week without dread, Clean room, Finish project"
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
              />
            </div>

            {composerError && (
              <div className="callout callout-danger" style={{ marginBottom: 16 }}>
                {composerError}
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button type="submit" className="btn btn-primary btn-lg" id="guest-generate-btn">
                ✨ Generate Instant Plan (No Signup)
                <ArrowRightIcon />
              </button>
            </div>
          </form>
        </section>
      )}

      {/* DRAFT REVIEW VIEW */}
      {mode === "review" && guestPlan && (
        <section className="draft-review-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <div className="eyebrow" style={{ color: "var(--accent)" }}>Step 2 of 2 · Review & Reorder</div>
              <h1 style={{ fontSize: "1.8rem", fontWeight: 700, margin: "4px 0" }}>
                {guestPlan.title}
              </h1>
              <p style={{ color: "var(--muted)", margin: 0 }}>
                {guestPlan.tasks.length} concrete action steps extracted in 10ms. Reorder if needed, or choose your first step.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleEditDump}
            >
              ← Edit dump
            </button>
          </div>

          <ol className="task-drag-list" style={{ listStyle: "none", padding: 0, margin: "20px 0" }}>
            {guestPlan.tasks.map((task, idx) => {
              const isStart = task.id === guestPlan.startTaskId;
              return (
                <li
                  key={task.id}
                  draggable
                  onDragStart={() => handleDragStart(task.id)}
                  onDragOver={(e) => handleDragOver(e, task.id)}
                  onDrop={(e) => handleDrop(e, task.id)}
                  className={`task-row ${draggingTaskId === task.id ? "is-dragging" : ""} ${
                    dragOverTaskId === task.id ? "drag-over" : ""
                  }`}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "14px 16px",
                    background: isStart ? "var(--surface-hover)" : "var(--surface)",
                    border: isStart ? "1px solid var(--accent)" : "1px solid var(--border)",
                    borderRadius: 8,
                    marginBottom: 10,
                    transition: "all 0.15s ease",
                  }}
                >
                  <span
                    style={{
                      cursor: "grab",
                      color: "var(--muted)",
                      userSelect: "none",
                      paddingTop: 2,
                    }}
                    title="Drag to reorder"
                    aria-hidden="true"
                  >
                    ⋮⋮
                  </span>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <strong style={{ fontSize: "1.05rem" }}>{task.title}</strong>
                      {isStart && (
                        <span className="pill pill-primary" style={{ fontSize: "0.75rem" }}>
                          <FlagIcon style={{ width: 12, height: 12 }} /> Start Here
                        </span>
                      )}
                      <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                        {formatEffort(task.effortMin, task.effortMax)}
                      </span>
                    </div>
                    <p style={{ margin: "4px 0 0", fontSize: "0.9rem", color: "var(--muted)" }}>
                      {task.description}
                    </p>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleMoveTask(idx, idx - 1)}
                      disabled={idx === 0}
                      title="Move Up"
                      aria-label={`Move ${task.title} up`}
                    >
                      <ArrowUpIcon style={{ width: 14, height: 14 }} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleMoveTask(idx, idx + 1)}
                      disabled={idx === guestPlan.tasks.length - 1}
                      title="Move Down"
                      aria-label={`Move ${task.title} down`}
                    >
                      <ArrowDownIcon style={{ width: 14, height: 14 }} />
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${isStart ? "btn-primary" : "btn-outline"}`}
                      onClick={() => handleSetStartTask(task.id)}
                      title="Set as start task"
                    >
                      {isStart ? "First Step" : "Make First"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 24 }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleReset}
            >
              Start over
            </button>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              id="guest-activate-btn"
              onClick={handleActivatePlan}
            >
              🚀 Activate & Open Workspace
              <ArrowRightIcon />
            </button>
          </div>
        </section>
      )}

      {/* ACTIVE WORKSPACE VIEW */}
      {mode === "workspace" && guestPlan && (
        <section className="guest-workspace">
          {/* Header & Meta */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
              <div>
                <span className="pill pill-success" style={{ marginBottom: 8, display: "inline-block" }}>
                  Active Plan · Guest Mode
                </span>
                <h1 style={{ fontSize: "2rem", fontWeight: 700, margin: "4px 0" }}>
                  {guestPlan.title}
                </h1>
                <p style={{ color: "var(--muted)", margin: 0 }}>
                  <strong>Goal:</strong> {guestPlan.desiredOutcome}
                </p>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={handleCopyMarkdown}
                  title="Copy as Markdown"
                >
                  📋 Copy Markdown
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={handleDownloadTxt}
                  title="Download as Text"
                >
                  <DownloadIcon /> Export
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={handleReset}
                  title="Start a new dump"
                >
                  <RotateIcon /> New Dump
                </button>
              </div>
            </div>

            {copyNotice && (
              <div className="callout callout-success" style={{ marginTop: 12, padding: "8px 12px" }}>
                {copyNotice}
              </div>
            )}

            {/* Progress bar */}
            <div style={{ marginTop: 20, background: "var(--surface)", padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", fontWeight: 600, marginBottom: 6 }}>
                <span>Progress</span>
                <span>
                  {doneTasks} of {totalTasks} steps completed ({progressPercent}%)
                </span>
              </div>
              <div style={{ height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${progressPercent}%`,
                    background: "var(--accent)",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Focused First Step Hero Card if not completed */}
          {startTask && startTask.status !== "done" && (
            <div
              className="start-hero-card"
              style={{
                background: "var(--surface)",
                border: "2px solid var(--accent)",
                borderRadius: 12,
                padding: "20px 24px",
                marginBottom: 24,
                boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--accent)", fontWeight: 600, fontSize: "0.85rem", marginBottom: 6 }}>
                <FlagIcon /> ONE CLEAR FIRST STEP
              </div>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 700, margin: "4px 0 8px" }}>
                {startTask.title}
              </h2>
              <p style={{ color: "var(--muted)", margin: "0 0 16px" }}>
                {startTask.description}
              </p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                  <ClockIcon style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                  Estimated effort: {formatEffort(startTask.effortMin, startTask.effortMax)}
                </span>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleToggleTask(startTask.id)}
                >
                  <CheckIcon /> Mark Step Complete
                </button>
              </div>
            </div>
          )}

          {/* Task List */}
          <div style={{ marginBottom: 32 }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: 12 }}>
              All Steps ({guestPlan.tasks.length})
            </h3>
            <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {guestPlan.tasks.map((task, idx) => {
                const isDone = task.status === "done";
                const isNoteOpen = openNoteTaskId === task.id;

                return (
                  <li
                    key={task.id}
                    draggable
                    onDragStart={() => handleDragStart(task.id)}
                    onDragOver={(e) => handleDragOver(e, task.id)}
                    onDrop={(e) => handleDrop(e, task.id)}
                    className={`task-row ${draggingTaskId === task.id ? "is-dragging" : ""} ${
                      dragOverTaskId === task.id ? "drag-over" : ""
                    }`}
                    style={{
                      background: isDone ? "var(--surface-muted)" : "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      padding: "14px 16px",
                      marginBottom: 10,
                      opacity: isDone ? 0.75 : 1,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <button
                        type="button"
                        onClick={() => handleToggleTask(task.id)}
                        className={`checkbox-btn ${isDone ? "is-checked" : ""}`}
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 6,
                          border: isDone ? "none" : "2px solid var(--border)",
                          background: isDone ? "var(--accent)" : "transparent",
                          color: "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          marginTop: 2,
                          padding: 0,
                        }}
                        aria-label={isDone ? `Mark ${task.title} as incomplete` : `Mark ${task.title} as done`}
                      >
                        {isDone && <CheckIcon style={{ width: 14, height: 14 }} />}
                      </button>

                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span
                            style={{
                              fontSize: "1.05rem",
                              fontWeight: 600,
                              textDecoration: isDone ? "line-through" : "none",
                              color: isDone ? "var(--muted)" : "var(--foreground)",
                            }}
                          >
                            {task.title}
                          </span>
                          <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                            {formatEffort(task.effortMin, task.effortMax)}
                          </span>
                        </div>
                        <p style={{ margin: "4px 0 0", fontSize: "0.9rem", color: "var(--muted)" }}>
                          {task.description}
                        </p>

                        {/* Scratch note display */}
                        {task.note && !isNoteOpen && (
                          <div
                            style={{
                              marginTop: 8,
                              fontSize: "0.85rem",
                              background: "var(--surface-hover)",
                              padding: "6px 10px",
                              borderRadius: 6,
                              fontStyle: "italic",
                            }}
                          >
                            Note: {task.note}
                          </div>
                        )}

                        {/* Note editor expanded */}
                        {isNoteOpen && (
                          <div style={{ marginTop: 10 }}>
                            <textarea
                              rows={2}
                              className="input"
                              placeholder="Add scratch notes, links, or updates on this step..."
                              value={task.note}
                              onChange={(e) => handleUpdateNote(task.id, e.target.value)}
                              style={{ width: "100%", fontSize: "0.85rem" }}
                            />
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => setOpenNoteTaskId(null)}
                              style={{ marginTop: 4 }}
                            >
                              Done editing note
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setOpenNoteTaskId(isNoteOpen ? null : task.id)}
                          title="Add / edit note"
                          aria-label="Add or edit note"
                        >
                          <NoteIcon style={{ width: 14, height: 14 }} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleMoveTask(idx, idx - 1)}
                          disabled={idx === 0}
                          title="Move Up"
                          aria-label="Move Up"
                        >
                          <ArrowUpIcon style={{ width: 14, height: 14 }} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleMoveTask(idx, idx + 1)}
                          disabled={idx === guestPlan.tasks.length - 1}
                          title="Move Down"
                          aria-label="Move Down"
                        >
                          <ArrowDownIcon style={{ width: 14, height: 14 }} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleDeleteTask(task.id)}
                          title="Remove step"
                          aria-label="Remove step"
                          style={{ color: "var(--danger)" }}
                        >
                          <TrashIcon style={{ width: 14, height: 14 }} />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Bottom Conversion Promotion */}
          <div
            className="card"
            style={{
              padding: "24px 28px",
              background: "var(--surface)",
              borderRadius: 12,
              border: "1px solid var(--border)",
              textAlign: "center",
            }}
          >
            <div style={{ maxWidth: 500, margin: "0 auto" }}>
              <h3 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: 8 }}>
                Save this plan to your account
              </h3>
              <p style={{ color: "var(--muted)", marginBottom: 18, fontSize: "0.95rem" }}>
                Clearstep is 100% free. Create an account to sync your completed steps across devices, generate new plans, and export your timeline.
              </p>
              <Link href="/signup?claim=true" className="btn btn-primary btn-lg">
                Create Free Account & Save Plan
                <ArrowRightIcon />
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
