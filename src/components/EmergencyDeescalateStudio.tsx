"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRightIcon,
  BellIcon,
  BellOffIcon,
  CheckIcon,
  ClockIcon,
  CloseIcon,
  HeartPulseIcon,
  LeafIcon,
  PauseIcon,
  PlayIcon,
  RotateIcon,
  SparkIcon,
} from "@/components/Icons";
import { MicroSprintTimer } from "@/components/MicroSprintTimer";
import { VoiceInputButton } from "@/components/VoiceInputButton";
import {
  calculateBreathState,
  DEFAULT_TARGET_CYCLES,
  getPhaseDetails,
  type BreathPhase,
} from "@/lib/breathing";
import { playGentleBell } from "@/lib/chime";
import { formatSpokenChunk } from "@/lib/use-voice-dictation";

type ResetStep = "somatic" | "grounding" | "action" | "sprint" | "completed";

interface EmergencyDeescalateStudioProps {
  onDismiss?: () => void;
  isModal?: boolean;
  initialHeaviestThought?: string;
}

const INSPIRATION_CHIPS = [
  "💧 Drink a cold glass of water",
  "🪑 Stand up and stretch for 30 seconds",
  "📝 Write down the first word or bullet",
  "🗂️ Clear one single item off my desk",
  "🪟 Open the window and take 3 deep breaths",
  "📱 Place phone face-down across the room",
];

export function EmergencyDeescalateStudio({
  onDismiss,
  isModal = false,
  initialHeaviestThought = "",
}: EmergencyDeescalateStudioProps) {
  const router = useRouter();

  const [step, setStep] = useState<ResetStep>("somatic");

  // Phase 1: Somatic Breathing State
  const [isBreathingRunning, setIsBreathingRunning] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isChimeEnabled, setIsChimeEnabled] = useState(true);
  const prevPhaseRef = useRef<BreathPhase>("inhale");
  const startTimeRef = useRef<number>(0);
  const accumulatedRef = useRef<number>(0);

  // Phase 2: Grounding State
  const [heaviestThought, setHeaviestThought] = useState(initialHeaviestThought);
  const [realityCheckAnswer, setRealityCheckAnswer] = useState<
    "safe" | "urgent-but-present" | null
  >(null);

  // Phase 3: Action Bridge State
  const [microStep, setMicroStep] = useState("");
  const [activeSprintTask, setActiveSprintTask] = useState<string | null>(null);

  const breathState = calculateBreathState(elapsedSeconds);
  const phaseDetails = getPhaseDetails(breathState.phase);

  // Breathing loop with high-precision timestamp
  useEffect(() => {
    if (step !== "somatic" || !isBreathingRunning) return;

    startTimeRef.current = Date.now();
    const interval = window.setInterval(() => {
      const now = Date.now();
      const currentElapsed = accumulatedRef.current + (now - startTimeRef.current) / 1000;
      setElapsedSeconds(currentElapsed);

      const updated = calculateBreathState(currentElapsed);
      if (updated.phase !== prevPhaseRef.current) {
        prevPhaseRef.current = updated.phase;
        if (isChimeEnabled) {
          playGentleBell(0.12);
        }
      }
    }, 150);

    return () => {
      window.clearInterval(interval);
      accumulatedRef.current += (Date.now() - startTimeRef.current) / 1000;
    };
  }, [step, isBreathingRunning, isChimeEnabled]);

  function toggleBreathingPause() {
    if (isBreathingRunning) {
      accumulatedRef.current += (Date.now() - startTimeRef.current) / 1000;
      setIsBreathingRunning(false);
    } else {
      startTimeRef.current = Date.now();
      setIsBreathingRunning(true);
    }
  }

  function handleResetBreathing() {
    accumulatedRef.current = 0;
    startTimeRef.current = Date.now();
    setElapsedSeconds(0);
    prevPhaseRef.current = "inhale";
    setIsBreathingRunning(true);
  }

  function handleStartSprint() {
    const taskTitle = microStep.trim() || "Take 5 quiet minutes to reset";
    setActiveSprintTask(taskTitle);
    setStep("sprint");
  }

  function handleTransferToPlan() {
    const combinedDump = [
      heaviestThought ? `What felt overwhelming:\n${heaviestThought}` : "",
      microStep ? `My first micro-step:\n${microStep}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    try {
      window.sessionStorage.setItem("clearstep_reset_prefill", combinedDump);
    } catch {
      // sessionStorage unavailable
    }

    if (onDismiss) {
      onDismiss();
    }
    router.push("/try?prefill=reset");
  }

  return (
    <div className={`emergency-studio ${isModal ? "is-modal-view" : ""}`}>
      {/* Top Banner & Navigation */}
      <div className="emergency-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="emergency-badge">
            <HeartPulseIcon style={{ width: 16, height: 16 }} />
            <span>First-Aid Grounding</span>
          </span>
          {step !== "completed" && (
            <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
              Step{" "}
              {step === "somatic"
                ? "1 of 3: Somatic Reset"
                : step === "grounding"
                ? "2 of 3: Unburdening"
                : "3 of 3: Micro-Step"}
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {step === "somatic" && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setIsChimeEnabled((prev) => !prev)}
              title={isChimeEnabled ? "Mute breath chime" : "Enable breath chime"}
              aria-label={isChimeEnabled ? "Mute breath chime" : "Enable breath chime"}
            >
              {isChimeEnabled ? (
                <BellIcon style={{ width: 15, height: 15 }} />
              ) : (
                <BellOffIcon style={{ width: 15, height: 15 }} />
              )}
            </button>
          )}

          {onDismiss && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onDismiss}
              aria-label="Close emergency reset"
              title="Close"
            >
              <CloseIcon style={{ width: 16, height: 16 }} />
            </button>
          )}
        </div>
      </div>

      {/* PHASE 1: SOMATIC RESET */}
      {step === "somatic" && (
        <section className="emergency-phase-card">
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: 8 }}>
              Breathe With Us.
            </h1>
            <p style={{ color: "var(--muted)", maxWidth: 520, margin: "0 auto", fontSize: "0.95rem" }}>
              Your autonomic nervous system is in fight-or-flight. We need your body to feel safe before your brain can plan.
            </p>
          </div>

          {/* Breathing Orb Visualization */}
          <div className="breath-orb-container" aria-live="polite">
            <div
              className={`breath-orb breath-orb-${breathState.phase} ${
                !isBreathingRunning ? "is-paused" : ""
              }`}
              style={{
                transform: `scale(${phaseDetails.scale})`,
              }}
            >
              <div className="breath-orb-glow" />
              <div className="breath-orb-inner">
                <div className="breath-orb-label">{phaseDetails.label}</div>
                <div className="breath-orb-counter">{breathState.secondsRemainingInPhase}</div>
                <div className="breath-orb-sub">seconds</div>
              </div>
            </div>

            <div className="breath-instruction">
              <div className="breath-instruction-primary">{phaseDetails.instruction}</div>
              <div className="breath-instruction-secondary">{phaseDetails.guidance}</div>
            </div>

            <div className="breath-meta-row">
              <span className="cycle-counter">
                Cycle {breathState.cycleIndex} of {DEFAULT_TARGET_CYCLES}
              </span>
              <span className="reassurance-text">
                &ldquo;You don&apos;t have to fix your whole life right now. Just this breath.&rdquo;
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="emergency-action-bar">
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={toggleBreathingPause}
                aria-label={isBreathingRunning ? "Pause breathing" : "Resume breathing"}
              >
                {isBreathingRunning ? (
                  <>
                    <PauseIcon style={{ width: 14, height: 14 }} />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <PlayIcon style={{ width: 14, height: 14 }} />
                    <span>Resume</span>
                  </>
                )}
              </button>

              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleResetBreathing}
                title="Restart breathing from Cycle 1"
                aria-label="Restart breathing"
              >
                <RotateIcon style={{ width: 14, height: 14 }} />
                <span>Reset</span>
              </button>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              id="proceed-to-grounding-btn"
              onClick={() => setStep("grounding")}
            >
              <span>I feel calmer now → Unburden thoughts</span>
              <ArrowRightIcon />
            </button>
          </div>
        </section>
      )}

      {/* PHASE 2: COGNITIVE GROUNDING */}
      {step === "grounding" && (
        <section className="emergency-phase-card">
          <div style={{ marginBottom: 20 }}>
            <span className="eyebrow" style={{ color: "var(--accent)" }}>
              Step 2 · Cognitive Reality Check
            </span>
            <h2 style={{ fontSize: "1.6rem", fontWeight: 700, margin: "6px 0 10px" }}>
              Drop the Mental Weight
            </h2>
            <div className="grounding-reassurance-box">
              <LeafIcon style={{ width: 18, height: 18, color: "var(--accent)", flexShrink: 0 }} />
              <span>
                Panic tricks the mind into believing <em>everything</em> must be solved simultaneously. In physical reality, humans can only ever execute one action at a time.
              </span>
            </div>
          </div>

          <div className="field" style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
              <label htmlFor="heaviest-thought-input" className="field-label" style={{ marginBottom: 0 }}>
                What is the single thing weighing heaviest right now?
              </label>
              <VoiceInputButton
                onTranscriptChunk={(chunk) => {
                  setHeaviestThought((prev) => formatSpokenChunk(prev, chunk));
                }}
              />
            </div>
            <textarea
              id="heaviest-thought-input"
              className="input"
              rows={4}
              placeholder="e.g., I have 15 emails waiting, my apartment is a disaster, and I feel like I'm letting everyone down..."
              value={heaviestThought}
              onChange={(e) => setHeaviestThought(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label className="field-label" style={{ marginBottom: 8, display: "block" }}>
              Quick Reality Check: Can this actually cause physical harm to you in the next 30 minutes?
            </label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                className={`btn btn-sm ${
                  realityCheckAnswer === "safe" ? "btn-primary" : "btn-outline"
                }`}
                onClick={() => setRealityCheckAnswer("safe")}
              >
                <CheckIcon style={{ width: 14, height: 14 }} />
                <span>No, I am physically safe right now.</span>
              </button>
              <button
                type="button"
                className={`btn btn-sm ${
                  realityCheckAnswer === "urgent-but-present" ? "btn-primary" : "btn-outline"
                }`}
                onClick={() => setRealityCheckAnswer("urgent-but-present")}
              >
                <span>It feels urgent, but I have this exact minute.</span>
              </button>
            </div>

            {realityCheckAnswer && (
              <div className="reality-check-verdict" aria-live="polite">
                ✨ <strong>Good.</strong> Your survival is secure. The weight is just mental fog. Let&apos;s isolate one ridiculous micro-step.
              </div>
            )}
          </div>

          <div className="emergency-action-bar">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setStep("somatic")}
            >
              ← Back to breathing
            </button>

            <button
              type="button"
              className="btn btn-primary"
              id="proceed-to-action-btn"
              onClick={() => setStep("action")}
            >
              <span>Next: Pick One Tiny Step</span>
              <ArrowRightIcon />
            </button>
          </div>
        </section>
      )}

      {/* PHASE 3: THE MICRO-STEP BRIDGE */}
      {step === "action" && (
        <section className="emergency-phase-card">
          <div style={{ marginBottom: 20 }}>
            <span className="eyebrow" style={{ color: "var(--accent)" }}>
              Step 3 · Immediate Momentum
            </span>
            <h2 style={{ fontSize: "1.6rem", fontWeight: 700, margin: "6px 0 8px" }}>
              One Absurdly Small Action
            </h2>
            <p style={{ color: "var(--muted)", fontSize: "0.95rem" }}>
              Do not try to fix the whole problem. Choose an action so tiny that it requires zero willpower to start.
            </p>
          </div>

          {/* Quick inspiration chips */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--muted)", marginBottom: 8 }}>
              Click to select a micro-action:
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {INSPIRATION_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: "0.8rem", borderRadius: 20 }}
                  onClick={() => setMicroStep(chip.replace(/^[^\s]+\s*/, ""))}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          <div className="field" style={{ marginBottom: 24 }}>
            <label htmlFor="micro-step-input" className="field-label">
              My single 2-minute step:
            </label>
            <input
              id="micro-step-input"
              type="text"
              className="input"
              placeholder="e.g. Put shoes on and drink a glass of cold water"
              value={microStep}
              onChange={(e) => setMicroStep(e.target.value)}
            />
          </div>

          <div className="action-launch-grid">
            <button
              type="button"
              className="btn btn-primary btn-lg action-launch-card"
              id="launch-sprint-btn"
              onClick={handleStartSprint}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <ClockIcon style={{ width: 22, height: 22 }} />
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: 700, fontSize: "1rem" }}>
                    Start 5-Minute Sprint on this Step
                  </div>
                  <div style={{ fontSize: "0.82rem", opacity: 0.9 }}>
                    Calm 5-minute container with meditation chime
                  </div>
                </div>
              </div>
              <ArrowRightIcon />
            </button>

            <button
              type="button"
              className="btn btn-outline btn-lg action-launch-card"
              onClick={handleTransferToPlan}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <SparkIcon style={{ width: 22, height: 22 }} />
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: 700, fontSize: "1rem" }}>
                    Build a Structured Plan from This
                  </div>
                  <div style={{ fontSize: "0.82rem", opacity: 0.8 }}>
                    Send thoughts to Clearstep Guest Sandbox
                  </div>
                </div>
              </div>
              <ArrowRightIcon />
            </button>
          </div>

          <div className="emergency-action-bar" style={{ marginTop: 20 }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setStep("grounding")}
            >
              ← Back to grounding
            </button>

            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setStep("completed")}
            >
              <span>I did my step! I&apos;m grounded.</span>
              <CheckIcon style={{ width: 14, height: 14 }} />
            </button>
          </div>
        </section>
      )}

      {/* PHASE 3B: EMBEDDED MICRO-SPRINT TIMER */}
      {step === "sprint" && activeSprintTask && (
        <section className="emergency-phase-card">
          <div style={{ marginBottom: 16 }}>
            <span className="eyebrow" style={{ color: "var(--accent)" }}>
              Active 5-Minute Sprint
            </span>
            <h2 style={{ fontSize: "1.4rem", fontWeight: 700, margin: "4px 0" }}>
              {activeSprintTask}
            </h2>
            <p style={{ color: "var(--muted)", fontSize: "0.88rem" }}>
              Focus only on this single step. When the chime sounds, you are free to stop or continue.
            </p>
          </div>

          <MicroSprintTimer
            task={{ id: "emergency-sprint", title: activeSprintTask }}
            onCompleteTask={() => {
              setStep("completed");
            }}
            onClose={() => {
              setStep("action");
            }}
          />
        </section>
      )}

      {/* PHASE 4: COMPLETED / GROUNDED CONFIRMATION */}
      {step === "completed" && (
        <section className="emergency-phase-card" style={{ textAlign: "center", padding: "36px 20px" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "var(--accent)",
              color: "var(--forest-deep)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <CheckIcon style={{ width: 28, height: 28 }} />
          </div>

          <h2 style={{ fontSize: "1.8rem", fontWeight: 700, marginBottom: 8 }}>
            You Got Through the Wave.
          </h2>
          <p style={{ color: "var(--muted)", maxWidth: 480, margin: "0 auto 24px", fontSize: "1rem" }}>
            You slowed your breath, checked physical reality, and took one clear step. That is how every overwhelming mountain is crossed.
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
            <Link href="/try" className="btn btn-primary" onClick={onDismiss}>
              <span>Try Guest Sandbox</span>
              <ArrowRightIcon />
            </Link>

            <Link href="/plans" className="btn btn-outline" onClick={onDismiss}>
              My Plans
            </Link>

            {onDismiss && (
              <button type="button" className="btn btn-ghost" onClick={onDismiss}>
                Close
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
