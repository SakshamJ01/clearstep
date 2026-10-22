"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  ArrowLeftIcon,
  CheckIcon,
  ClockIcon,
  LockIcon,
  SparkIcon,
  TrashIcon,
  WarningIcon,
} from "@/components/Icons";
import { clearComposerDraft } from "@/lib/composer-draft";
import { formatDateTime, pluralize } from "@/lib/format";
import type { AiPreference } from "@/lib/schemas";
import type { UsageSummary } from "@/lib/rate-limit";

interface SettingsPanelProps {
  userId: string;
  email: string;
  createdAt: string;
  initialPreference: AiPreference;
  aiAvailable: boolean;
  providerName: string;
  usage: UsageSummary;
  planCount: number;
  retainedDumpCount: number;
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

export function SettingsPanel({
  userId,
  email,
  createdAt,
  initialPreference,
  aiAvailable,
  providerName,
  usage,
  planCount,
  retainedDumpCount: initialRetainedDumpCount,
}: SettingsPanelProps) {
  const router = useRouter();
  const [preference, setPreference] = useState<AiPreference>(initialPreference);
  const [savingPreference, setSavingPreference] = useState(false);
  const [preferenceStatus, setPreferenceStatus] = useState<{
    tone: "ok" | "error";
    message: string;
  } | null>(null);
  const [retainedDumpCount, setRetainedDumpCount] = useState(
    initialRetainedDumpCount,
  );
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [dataStatus, setDataStatus] = useState<{
    tone: "ok" | "error";
    message: string;
  } | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function savePreference(next: AiPreference) {
    const previous = preference;
    setPreference(next);
    setSavingPreference(true);
    setPreferenceStatus(null);
    try {
      const response = await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiPreference: next }),
      });
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      const data = (await response.json().catch(() => ({}))) as ApiFailure;
      if (!response.ok) {
        setPreference(previous);
        setPreferenceStatus({
          tone: "error",
          message: apiMessage(data, "That preference could not be saved."),
        });
        return;
      }
      setPreferenceStatus({
        tone: "ok",
        message:
          next === "ask"
            ? "Saved. New drafts will ask for AI consent each time."
            : "Saved. New drafts will use the manual planner.",
      });
      router.refresh();
    } catch {
      setPreference(previous);
      setPreferenceStatus({
        tone: "error",
        message: "The connection failed. That preference was not saved.",
      });
    } finally {
      setSavingPreference(false);
    }
  }

  async function clearDumps() {
    setClearing(true);
    setDataStatus(null);
    try {
      const response = await fetch("/api/account/dumps", { method: "DELETE" });
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      const data = (await response.json().catch(() => ({}))) as ApiFailure & {
        cleared?: number;
      };
      if (!response.ok) {
        setDataStatus({
          tone: "error",
          message: apiMessage(data, "The retained dumps could not be cleared."),
        });
        setClearOpen(false);
        return;
      }
      setRetainedDumpCount(0);
      setClearOpen(false);
      setDataStatus({
        tone: "ok",
        message: `Cleared ${pluralize(
          data.cleared ?? 0,
          "retained brain dump",
        )}. Your plans and tasks were not changed.`,
      });
      router.refresh();
    } catch {
      setClearOpen(false);
      setDataStatus({
        tone: "error",
        message: "The connection failed. No retained data was cleared.",
      });
    } finally {
      setClearing(false);
    }
  }

  async function deleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (deleting || deleteConfirmation !== "DELETE") return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "DELETE" }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as ApiFailure;
        setDeleteError(apiMessage(data, "The account could not be deleted."));
        return;
      }
      clearComposerDraft(userId);
      router.push("/");
      router.refresh();
    } catch {
      setDeleteError("The connection failed. Your account was not deleted.");
    } finally {
      setDeleting(false);
    }
  }

  const hourPercent = Math.min(
    100,
    Math.round((usage.usedThisHour / usage.hourlyLimit) * 100),
  );
  const dayPercent = Math.min(
    100,
    Math.round((usage.usedToday / usage.dailyLimit) * 100),
  );

  return (
    <>
      <header className="page-header" style={{ marginBottom: 26 }}>
        <div className="eyebrow">Settings</div>
        <h1 className="page-title">Keep the terms visible.</h1>
        <p className="page-subtitle">
          AI stays optional. Your data has a short retention window. Leaving is
          a button, not an email thread.
        </p>
      </header>

      <div className="settings-grid">
        <div className="settings-main">
          <section className="card settings-card" aria-labelledby="ai-settings">
            <h2 id="ai-settings">AI drafting</h2>
            <p>
              AI can help turn a dump into a structure, but it never runs without
              your explicit consent per draft. Manual planning always works.
            </p>

            <div className="choice-grid" role="radiogroup" aria-label="AI preference">
              <label className="choice-card">
                <input
                  type="radio"
                  name="aiPreference"
                  value="ask"
                  checked={preference === "ask"}
                  onChange={() => savePreference("ask")}
                  disabled={savingPreference}
                />
                <span className="choice-radio" aria-hidden="true" />
                <span>
                  <strong>Ask me each time</strong>
                  <small>
                    The composer starts with consent off. Manual planning is the
                    default.
                  </small>
                </span>
              </label>
              <label className="choice-card">
                <input
                  type="radio"
                  name="aiPreference"
                  value="manual_only"
                  checked={preference === "manual_only"}
                  onChange={() => savePreference("manual_only")}
                  disabled={savingPreference}
                />
                <span className="choice-radio" aria-hidden="true" />
                <span>
                  <strong>Manual only</strong>
                  <small>
                    Hide AI drafting. Nothing leaves this server for plan
                    generation.
                  </small>
                </span>
              </label>
            </div>

            <div className="usage-block">
              <div className="usage-block-head">
                <span>
                  <SparkIcon
                    style={{ width: 14, height: 14, verticalAlign: "-2px" }}
                  />{" "}
                  AI draft allowance
                </span>
                <span>
                  {aiAvailable ? providerName : "No provider configured"}
                </span>
              </div>
              <div className="usage-bars">
                <div className="usage-bar-row">
                  <span>Hour</span>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${hourPercent}%` }}
                    />
                  </div>
                  <span>
                    {usage.usedThisHour}/{usage.hourlyLimit} used
                  </span>
                </div>
                <div className="usage-bar-row">
                  <span>Day</span>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${dayPercent}%` }}
                    />
                  </div>
                  <span>
                    {usage.usedToday}/{usage.dailyLimit} used
                  </span>
                </div>
              </div>
            </div>

            {!aiAvailable ? (
              <div className="callout callout-quiet" style={{ marginTop: 14 }}>
                <LockIcon />
                <div>
                  AI drafting is not configured on this server. Manual planning is
                  available with no usage limit.
                </div>
              </div>
            ) : null}

            <div className="setting-actions">
              {savingPreference ? (
                <span className="setting-status">Saving preference…</span>
              ) : preferenceStatus ? (
                <span className={`setting-status ${preferenceStatus.tone}`}>
                  {preferenceStatus.message}
                </span>
              ) : (
                <span className="setting-status">
                  Changes save as soon as you choose.
                </span>
              )}
            </div>
          </section>

          <section
            className="card settings-card"
            id="data"
            aria-labelledby="data-settings"
          >
            <h2 id="data-settings">Your data</h2>
            <p>
              Brain dumps are encrypted at rest. Approved-plan dumps are cleared
              after 30 days; unapproved drafts disappear after 7 days. Plan tasks
              and notes stay until you delete the plan or account.
            </p>
            <div className="data-facts">
              <div className="data-fact">
                <LockIcon />
                <div>
                  <strong>Encrypted at rest</strong>
                  <p>
                    Raw dumps, constraints, and private task notes are stored with
                    AES-256-GCM encryption.
                  </p>
                </div>
              </div>
              <div className="data-fact">
                <ClockIcon />
                <div>
                  <strong>Short retention</strong>
                  <p>
                    Raw dumps are removed on a 30-day schedule. Unapproved drafts
                    are removed after 7 days. Clearing dumps does not touch plans.
                  </p>
                </div>
              </div>
              <div className="data-fact">
                <CheckIcon />
                <div>
                  <strong>No silent integrations</strong>
                  <p>
                    No calendar, email, task-provider, or analytics integration.
                    Export is manual.
                  </p>
                </div>
              </div>
            </div>

            <div className="row-between" style={{ gap: 12 }}>
              <span className="field-hint">
                {pluralize(planCount, "plan")} on this account ·{" "}
                {pluralize(retainedDumpCount, "raw dump")} still retained
              </span>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setClearOpen(true)}
                disabled={retainedDumpCount === 0 || clearing}
              >
                <TrashIcon />
                Clear retained dumps
              </button>
            </div>

            {dataStatus ? (
              <p
                className={`setting-status ${dataStatus.tone}`}
                role="status"
                style={{ marginTop: 10 }}
              >
                {dataStatus.message}
              </p>
            ) : null}
          </section>

          <section
            className="card settings-card danger-card"
            aria-labelledby="danger-settings"
          >
            <h2 id="danger-settings">Delete account</h2>
            <p>
              This permanently removes your account, sessions, plans, tasks,
              notes, drafts, and retained dumps. Export anything you want to keep
              first. There is no recovery window.
            </p>
            <form className="delete-account-form" onSubmit={deleteAccount}>
              <label className="field-label" htmlFor="delete-confirm">
                Type DELETE to confirm
              </label>
              <input
                id="delete-confirm"
                className="input"
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder="DELETE"
                aria-required="true"
              />
              {deleteError ? (
                <p className="field-error" role="alert">
                  {deleteError}
                </p>
              ) : null}
              <button
                type="submit"
                className="btn btn-danger-solid"
                disabled={deleteConfirmation !== "DELETE" || deleting}
              >
                <TrashIcon />
                {deleting ? "Deleting account…" : "Delete my account forever"}
              </button>
            </form>
          </section>
        </div>

        <aside className="settings-aside">
          <div className="card settings-card">
            <div className="profile-row">
              <div className="profile-avatar" aria-hidden="true">
                {email.slice(0, 1).toUpperCase()}
              </div>
              <div className="profile-copy">
                <strong>{email}</strong>
                <span>Account since {formatDateTime(createdAt)}</span>
              </div>
            </div>
            <dl className="plan-side-meta" style={{ marginTop: 16 }}>
              <div>
                <dt>AI preference</dt>
                <dd>{preference === "ask" ? "Ask each time" : "Manual only"}</dd>
              </div>
              <div>
                <dt>Plans</dt>
                <dd>{planCount}</dd>
              </div>
              <div>
                <dt>Retained dumps</dt>
                <dd>{retainedDumpCount}</dd>
              </div>
            </dl>
          </div>

          <div className="card settings-card">
            <h3 style={{ fontSize: 13, marginBottom: 9 }}>What this tool is not</h3>
            <ul className="notice-list">
              <li>
                <WarningIcon />
                Not medical, legal, or financial advice.
              </li>
              <li>
                <WarningIcon />
                Not a coach that will chase you or protect a streak.
              </li>
              <li>
                <WarningIcon />
                Not connected to your calendar, email, or other task apps.
              </li>
            </ul>
          </div>

          <Link href="/plans" className="btn btn-ghost btn-sm">
            <ArrowLeftIcon />
            Back to plans
          </Link>
        </aside>
      </div>

      <ConfirmDialog
        open={clearOpen}
        title="Clear retained brain dumps?"
        description={`This removes ${pluralize(
          retainedDumpCount,
          "raw brain dump",
        )} from encrypted storage. Plans, tasks, and notes stay intact. The action cannot be undone.`}
        confirmLabel="Clear dumps"
        tone="danger"
        busy={clearing}
        onConfirm={clearDumps}
        onCancel={() => setClearOpen(false)}
      />
    </>
  );
}
