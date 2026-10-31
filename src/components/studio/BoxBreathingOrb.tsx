"use client";

import {
  DEFAULT_TARGET_CYCLES,
  getPhaseDetails,
  type BreathPhase,
} from "@/lib/breathing";

interface BoxBreathingOrbProps {
  phase: BreathPhase;
  secondsRemainingInPhase: number;
  cycleIndex: number;
  isRunning: boolean;
}

export function BoxBreathingOrb({
  phase,
  secondsRemainingInPhase,
  cycleIndex,
  isRunning,
}: BoxBreathingOrbProps) {
  const phaseDetails = getPhaseDetails(phase);

  return (
    <div className="breath-orb-container" aria-live="polite">
      <div
        className={`breath-orb breath-orb-${phase} ${!isRunning ? "is-paused" : ""}`}
        style={{
          transform: `scale(${phaseDetails.scale})`,
        }}
      >
        <div className="breath-orb-glow" />
        <div className="breath-orb-inner">
          <div className="breath-orb-label">{phaseDetails.label}</div>
          <div className="breath-orb-counter">{secondsRemainingInPhase}</div>
          <div className="breath-orb-sub">seconds</div>
        </div>
      </div>

      <div className="breath-instruction">
        <div className="breath-instruction-primary">{phaseDetails.instruction}</div>
        <div className="breath-instruction-secondary">{phaseDetails.guidance}</div>
      </div>

      <div className="breath-meta-row">
        <span className="cycle-counter">
          Cycle {cycleIndex} of {DEFAULT_TARGET_CYCLES}
        </span>
        <span className="reassurance-text">
          &ldquo;You don&apos;t have to fix your whole life right now. Just this breath.&rdquo;
        </span>
      </div>
    </div>
  );
}
