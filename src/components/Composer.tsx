"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  LockIcon,
  SparkIcon,
  WarningIcon,
} from "@/components/Icons";
import type { AiPreference } from "@/lib/schemas";

interface UsageSummary {
  usedThisHour: number;
  usedToday: number;
  hourlyLimit: number;
  dailyLimit: number;
  resetsAt: string | null;
}

interface ComposerProps {
  userId: string;
  today: string;
  aiAvailable: boolean;
  providerName: string | null;
  aiPreference: AiPreference;
  usage: UsageSummary;
}

interface SavedComposer {
  dump: string;
  outcome: string;
  horizonDate: string;
  availableMinutes: string;
  constraints: string;
  requestId: string;
  savedAt: string;
}

interface ApiFailure {
  error?: {
    code?: string;
    message?: string;
    fields?: Record<string, string>;
    details?: { supportDetail?: string };
  };
}

const SAMPLE = {
  dump: `renew passport before the trip — I keep putting it off
ask Sam about splitting the rent, it's been weird for weeks
portfolio still not started and everyone else seems to have one
call the dentist. it has been... a while
I need to figure out what I actually want to do this year but that feels too big
book the train tickets before prices go up`,
  outcome: "Clear the life admin I keep avoiding",
  availableMinutes: "180",
  constraints: "Evenings only, after 8pm. No admin on Sunday.",
};

function newRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

function wordCount(value: string): number {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

export function Composer({
  userId,
  today,
  aiAvailable,
  providerName,
  aiPreference,
  usage,
}: ComposerProps) {
  const router = useRouter();
  const dumpId = useId();
  const outcomeId = useId();
  const horizonId = useId();
  const availableId = useId();
  const constraintsId = useId();
  const consentId = useId();
  const errorId = useId();
  const storageKey = `clearstep:composer:v1:${userId}`;

  const dumpRef = useRef<HTMLTextAreaElement>(null);
  const [hydrated, setHydrated] = useState(false);
  const [dump, setDump] = useState("");
  const [outcome, setOutcome] = useState("");
  const [horizonDate, setHorizonDate] = useState("");
  const [availableMinutes, setAvailableMinutes] = useState("");
  const [constraints, setConstraints] = useState("");
  const [aiConsent, setAiConsent] = useState(false);
  const [requestId, setRequestId] = useState("");
  const [saveState, setSaveState] = useState<
    "saved" | "saving" | "error"
  >("saved");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [safety, setSafety] = useState<{
    message: string;
    detail: string;
  } | null>(null);

  const quotaExhausted =
    usage.usedThisHour >= usage.hourlyLimit ||
    usage.usedToday >= usage.dailyLimit;
  const aiAllowed =
    aiAvailable && aiPreference === "ask" && !quotaExhausted;
  const effectiveConsent = aiConsent && aiAllowed;
  const words = wordCount(dump);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (raw) {
          const saved = JSON.parse(raw) as Partial<SavedComposer>;
          if (typeof saved.dump === "string") setDump(saved.dump);
          if (typeof saved.outcome === "string") setOutcome(saved.outcome);
          if (typeof saved.horizonDate === "string") {
            setHorizonDate(saved.horizonDate);
          }
          if (typeof saved.availableMinutes === "string") {
            setAvailableMinutes(saved.availableMinutes);
          }
          if (typeof saved.constraints === "string") {
            setConstraints(saved.constraints);
          }
          if (
            typeof saved.requestId === "string" &&
            /^[A-Za-z0-9_-]{8,64}$/.test(saved.requestId)
          ) {
            setRequestId(saved.requestId);
          }
        }
      } catch {
        setSaveState("error");
      }
      setRequestId((current) => current || newRequestId());
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      try {
        const snapshot: SavedComposer = {
          dump,
          outcome,
          horizonDate,
          availableMinutes,
          constraints,
          requestId,
          savedAt: new Date().toISOString(),
        };
        window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 150);
    return () => window.clearTimeout(timer);
  }, [
    hydrated,
    dump,
    outcome,
    horizonDate,
    availableMinutes,
    constraints,
    requestId,
    storageKey,
  ]);

  function persistNow() {
    try {
      const snapshot: SavedComposer = {
        dump,
        outcome,
        horizonDate,
        availableMinutes,
        constraints,
        requestId,
        savedAt: new Date().toISOString(),
      };
      window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
      setSaveState("saved");
      return true;
    } catch {
      setSaveState("error");
      return false;
    }
  }

  function fillSample() {
    setDump(SAMPLE.dump);
    setOutcome(SAMPLE.outcome);
    setAvailableMinutes(SAMPLE.availableMinutes);
    setConstraints(SAMPLE.constraints);
    setFieldErrors({});
    setSafety(null);
    dumpRef.current?.focus();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const nextErrors: Record<string, string> = {};
    let minutes: number | null = null;
    const trimmedDump = dump.trim();
    const trimmedOutcome = outcome.trim();

    if (trimmedDump.length < 20) {
      nextErrors.dump = "Add a little more so there is something to plan.";
    }
    if (trimmedDump.length > 8000) {
      nextErrors.dump = "Keep the dump under 8,000 characters.";
    }
    if (trimmedOutcome.length < 3) {
      nextErrors.outcome = "Name the outcome you are aiming for.";
    }
    if (horizonDate && horizonDate < today) {
      nextErrors.horizonDate = "The deadline cannot be in the past.";
    }
    if (availableMinutes.trim()) {
      const parsed = Number(availableMinutes);
      if (
        !Number.isInteger(parsed) ||
        parsed < 30 ||
        parsed > 10080
      ) {
        nextErrors.availableMinutes =
          "Use a whole number between 30 and 10,080 minutes.";
      } else {
        minutes = parsed;
      }
    }

    setFieldErrors(nextErrors);
    setError(null);
    setSafety(null);
    if (Object.keys(nextErrors).length > 0) {
      if (nextErrors.dump) dumpRef.current?.focus();
      return;
    }

    let activeRequestId = requestId;
    if (!activeRequestId) {
      activeRequestId = newRequestId();
      setRequestId(activeRequestId);
    }
    persistNow();
    setPending(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 25_000);

    try {
      const response = await fetch("/api/plans/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          requestId: activeRequestId,
          dump: trimmedDump,
          outcome: trimmedOutcome,
          horizonDate: horizonDate || null,
          availableMinutesPerWeek: minutes,
          constraints: constraints.trim() || null,
          aiConsent: effectiveConsent,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as ApiFailure & {
        draftId?: string;
      };

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      if (!response.ok) {
        if (data.error?.code === "SAFETY_PAUSE") {
          setSafety({
            message:
              data.error.message ||
              "Planning is paused for this dump. Your text has not been sent.",
            detail:
              data.error.details?.supportDetail ||
              "If you are in immediate danger, contact local emergency services.",
          });
          return;
        }
        setError(
          data.error?.message ||
            "The draft could not be built. Your dump is still saved on this device.",
        );
        setFieldErrors(data.error?.fields ?? {});
        return;
      }

      if (!data.draftId) {
        setError(
          "The server returned an unexpected response. Your dump is still saved.",
        );
        return;
      }

      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // The draft is safely stored on the server; local cleanup can fail.
      }
      router.push(`/drafts/${data.draftId}`);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") {
        setError(
          "That took longer than expected. Your dump is still saved here. Retry is safe — it will not create a duplicate draft.",
        );
      } else {
        setError(
          "The connection failed. Your dump is still saved on this device. Retry when you are back online.",
        );
      }
    } finally {
      window.clearTimeout(timeout);
      setPending(false);
    }
  }

  return (
    <>
      <section className="page-header">
        <div className="eyebrow">New plan</div>
        <h1 className="page-title">Empty your head first.</h1>
        <p className="page-subtitle">
          Write the unfiltered version. Then add just enough context to make a
          realistic draft. You will review and edit everything before it becomes
          a plan.
        </p>
      </section>

      <div className="compose-layout">
        <form className="card compose-card compose-main" onSubmit={submit} noValidate>
          <div className="composer-top">
            <div>
              <h2>The dump</h2>
              <p>One messy paragraph is fine. Bullets work too.</p>
            </div>
            <div
              className="save-status"
              data-state={saveState}
              aria-live="polite"
            >
              {saveState === "saved"
                ? "Saved on this device"
                : saveState === "saving"
                  ? "Saving…"
                  : "Local save failed"}
            </div>
          </div>

          <div className="field">
            <div className="dump-label-row">
              <label className="field-label" htmlFor={dumpId}>
                What&apos;s taking up space?
              </label>
              <div className="row" style={{ gap: 12 }}>
                {dump.trim().length === 0 ? (
                  <button
                    type="button"
                    className="example-link"
                    onClick={fillSample}
                    disabled={pending}
                  >
                    Use a sample dump
                  </button>
                ) : null}
                <span className="word-count">
                  {words} words · {dump.length}/8,000
                </span>
              </div>
            </div>
            <textarea
              id={dumpId}
              ref={dumpRef}
              className="textarea textarea-lg"
              value={dump}
              onChange={(event) => {
                setDump(event.target.value);
                if (fieldErrors.dump) {
                  setFieldErrors((current) => {
                    const next = { ...current };
                    delete next.dump;
                    return next;
                  });
                }
              }}
              placeholder={
                "I still haven't written the thing I said I'd write. Also the flat is a mess, I need to call the dentist, and I promised to send Sam the rent details. There's a deadline at work next Friday that I keep pretending isn't real…"
              }
              maxLength={8000}
              disabled={pending}
              aria-invalid={Boolean(fieldErrors.dump)}
              aria-describedby={
                fieldErrors.dump
                  ? `${dumpId}-error ${dumpId}-hint`
                  : `${dumpId}-hint`
              }
              required
            />
            {fieldErrors.dump ? (
              <p className="field-error" id={`${dumpId}-error`}>
                {fieldErrors.dump}
              </p>
            ) : null}
            <p className="field-hint" id={`${dumpId}-hint`}>
              Autosaved in this browser as you type. Nothing leaves this device
              until you press the button below.
            </p>
          </div>

          <hr className="composer-divider" />

          <div className="context-title">Give the plan a shape</div>
          <p className="context-sub">
            These fields are the only planning context used for the draft.
          </p>

          <div className="field-grid">
            <div className="field span-2">
              <label className="field-label" htmlFor={outcomeId}>
                Desired outcome
              </label>
              <input
                id={outcomeId}
                className="input"
                value={outcome}
                onChange={(event) => setOutcome(event.target.value)}
                placeholder="e.g. Get the flat admin under control"
                maxLength={200}
                disabled={pending}
                aria-invalid={Boolean(fieldErrors.outcome)}
                aria-describedby={
                  fieldErrors.outcome ? `${outcomeId}-error` : undefined
                }
                required
              />
              {fieldErrors.outcome ? (
                <p className="field-error" id={`${outcomeId}-error`}>
                  {fieldErrors.outcome}
                </p>
              ) : null}
            </div>

            <div className="field">
              <label className="field-label" htmlFor={horizonId}>
                Deadline or horizon
                <span className="optional">Optional</span>
              </label>
              <input
                id={horizonId}
                className="input"
                type="date"
                value={horizonDate}
                min={today}
                disabled={pending}
                onChange={(event) => setHorizonDate(event.target.value)}
                aria-invalid={Boolean(fieldErrors.horizonDate)}
                aria-describedby={
                  fieldErrors.horizonDate ? `${horizonId}-error` : undefined
                }
              />
              {fieldErrors.horizonDate ? (
                <p className="field-error" id={`${horizonId}-error`}>
                  {fieldErrors.horizonDate}
                </p>
              ) : (
                <p className="field-hint">A real date, or leave it open.</p>
              )}
            </div>

            <div className="field">
              <label className="field-label" htmlFor={availableId}>
                Time available each week
                <span className="optional">Optional</span>
              </label>
              <div className="input-suffix-wrap">
                <input
                  id={availableId}
                  className="input"
                  type="number"
                  min={30}
                  max={10080}
                  step={30}
                  inputMode="numeric"
                  value={availableMinutes}
                  disabled={pending}
                  onChange={(event) => setAvailableMinutes(event.target.value)}
                  placeholder="e.g. 180"
                  aria-invalid={Boolean(fieldErrors.availableMinutes)}
                  aria-describedby={
                    fieldErrors.availableMinutes
                      ? `${availableId}-error`
                      : `${availableId}-hint`
                  }
                />
                <span className="input-suffix">min / week</span>
              </div>
              {fieldErrors.availableMinutes ? (
                <p className="field-error" id={`${availableId}-error`}>
                  {fieldErrors.availableMinutes}
                </p>
              ) : (
                <div className="quick-fill" id={`${availableId}-hint`}>
                  {[90, 180, 300, 600].map((value) => (
                    <button
                      key={value}
                      type="button"
                      disabled={pending}
                      onClick={() => setAvailableMinutes(String(value))}
                    >
                      {value < 60 ? `${value}m` : `${value / 60}h`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="field span-2">
              <label className="field-label" htmlFor={constraintsId}>
                Constraints worth respecting
                <span className="optional">Optional</span>
              </label>
              <textarea
                id={constraintsId}
                className="textarea"
                value={constraints}
                disabled={pending}
                onChange={(event) => setConstraints(event.target.value)}
                placeholder="e.g. Weeknights only. I can't spend money this month. The letter has to go out before the 12th."
                maxLength={600}
                style={{ minHeight: 82 }}
              />
              <p className="field-hint">
                Keep it practical: time, money, energy, access, or fixed dates.
              </p>
            </div>
          </div>

          <div className="consent-block">
            <div className="consent-main">
              <input
                id={consentId}
                type="checkbox"
                className="checkbox"
                checked={effectiveConsent}
                onChange={(event) => setAiConsent(event.target.checked)}
                disabled={!aiAllowed || pending}
                aria-describedby={`${consentId}-copy`}
              />
              <label htmlFor={consentId}>
                <span className="consent-title">
                  Let AI draft this one
                  <span className={`pill ${effectiveConsent ? "pill-acid" : ""}`}>
                    {effectiveConsent ? "Consent given" : "Off by default"}
                  </span>
                </span>
                <span className="consent-copy" id={`${consentId}-copy`}>
                  {aiAvailable
                    ? aiPreference === "manual_only"
                      ? "AI is turned off in your settings, so this draft will use the manual template. You can change that in Settings."
                      : quotaExhausted
                        ? "You have reached the AI draft limit for now. Manual planning still works and costs nothing."
                        : `If checked, this dump, outcome, deadline, available time, and constraints are sent to ${providerName || "the configured AI provider"} to produce a draft. No other plans or account history are included.`
                    : "No AI provider is configured on this server. Clearstep will build a manual draft from your own words instead."}
                </span>
              </label>
            </div>
            <div className="consent-usage">
              <span>
                AI drafts: {usage.usedThisHour}/{usage.hourlyLimit} this hour ·{" "}
                {usage.usedToday}/{usage.dailyLimit} today
              </span>
              <Link href="/settings" className="text-link" style={{ fontSize: 10.5 }}>
                AI preference
              </Link>
            </div>
          </div>

          {safety ? (
            <div className="callout callout-danger" role="alert" style={{ marginTop: 18 }}>
              <WarningIcon />
              <div>
                <strong>{safety.message}</strong>
                <p>{safety.detail}</p>
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="callout callout-warn" role="alert" style={{ marginTop: 18 }}>
              <WarningIcon />
              <div>{error}</div>
            </div>
          ) : null}

          {pending ? (
            <div className="generating" role="status" aria-live="polite">
              <span className="spinner" aria-hidden="true" />
              <div>
                <strong>
                  {effectiveConsent
                    ? "Sorting the dump into a draft…"
                    : "Building a manual draft…"}
                </strong>
                This usually takes under 20 seconds. Keep this tab open. Your
                input is already saved on this device.
              </div>
            </div>
          ) : null}

          <div className="composer-actions">
            <p className="composer-actions-note">
              {effectiveConsent
                ? "The result is a draft, not a commitment. You will review assumptions and tasks before approving."
                : "Manual mode uses only what you wrote. It does not invent outside tasks or send your dump to an AI provider."}
            </p>
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={pending}
            >
              {pending ? (
                "Building draft…"
              ) : effectiveConsent ? (
                <>
                  Generate editable draft
                  <SparkIcon />
                </>
              ) : (
                <>
                  Build a manual draft
                  <ArrowRightIcon />
                </>
              )}
            </button>
          </div>

          {Object.keys(fieldErrors).some(
            (key) => !["dump", "outcome", "horizonDate", "availableMinutes"].includes(key),
          ) ? (
            <div className="callout callout-danger" id={errorId} role="alert" style={{ marginTop: 16 }}>
              <WarningIcon />
              <div>
                {Object.entries(fieldErrors)
                  .filter(
                    ([key]) =>
                      !["dump", "outcome", "horizonDate", "availableMinutes"].includes(
                        key,
                      ),
                  )
                  .map(([, message]) => message)
                  .join(" ")}
              </div>
            </div>
          ) : null}
        </form>

        <aside className="composer-side" aria-label="Planning guidance">
          <div className="card side-card">
            <h3>Before you start</h3>
            <ul className="principles-list">
              <li>
                <CheckIcon />
                Include the boring bits, not just the impressive ones.
              </li>
              <li>
                <CheckIcon />
                Contradictions are allowed. The draft is where you sort them.
              </li>
              <li>
                <CheckIcon />
                Be honest about time. A plan that assumes a free week is fiction.
              </li>
            </ul>
            <p className="side-aside-note">
              This composer autosaves to your browser. On a shared device, clear
              the text or sign out when you are done.
            </p>
          </div>

          <div className="card side-card side-privacy">
            <h3>Where the text goes</h3>
            <p>
              Without AI consent, nothing leaves this app. With consent, only this
              dump and the planning fields are sent to the configured provider.
            </p>
            <Link href="/#privacy" className="text-link">
              Read the data handling note
            </Link>
          </div>

          <div className="card side-card">
            <h3>What happens next</h3>
            <p>
              You will get a draft with stated facts, flagged assumptions, a
              finite task list, and one suggested start. Edit it or discard it. No
              task becomes active until you approve.
            </p>
            <p className="side-aside-note">
              <ClockIcon style={{ display: "inline", width: 13, height: 13, verticalAlign: -2, marginRight: 4 }} />
              Generation target: under 20 seconds. Manual mode is always
              available.
            </p>
            <p className="side-aside-note">
              <LockIcon style={{ display: "inline", width: 13, height: 13, verticalAlign: -2, marginRight: 4 }} />
              Raw dumps are encrypted and cleared after 30 days.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
