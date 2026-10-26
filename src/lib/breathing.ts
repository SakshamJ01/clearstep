/**
 * Box breathing & physiological grounding calculations.
 * Standard 4-4-4-4 cycle (Inhale -> Hold -> Exhale -> Rest).
 * Zero-cost, 100% client-side ($0.00).
 */

export type BreathPhase = "inhale" | "hold-in" | "exhale" | "rest";

export interface PhaseDetails {
  key: BreathPhase;
  label: string;
  instruction: string;
  guidance: string;
  scale: number;
}

export const PHASE_DURATION = 4; // 4 seconds per phase
export const CYCLE_DURATION = PHASE_DURATION * 4; // 16 seconds per cycle
export const DEFAULT_TARGET_CYCLES = 4; // 4 cycles = ~64 seconds of grounding

export const PHASE_ORDER: BreathPhase[] = ["inhale", "hold-in", "exhale", "rest"];

export function getNextPhase(phase: BreathPhase): BreathPhase {
  const index = PHASE_ORDER.indexOf(phase);
  return PHASE_ORDER[(index + 1) % PHASE_ORDER.length];
}

export function getPhaseDetails(phase: BreathPhase): PhaseDetails {
  switch (phase) {
    case "inhale":
      return {
        key: "inhale",
        label: "Inhale",
        instruction: "Breathe in slowly through your nose",
        guidance: "Expand your belly and lungs gently.",
        scale: 1.35,
      };
    case "hold-in":
      return {
        key: "hold-in",
        label: "Hold",
        instruction: "Gently hold the breath inside",
        guidance: "Drop your shoulders and relax your jaw.",
        scale: 1.35,
      };
    case "exhale":
      return {
        key: "exhale",
        label: "Exhale",
        instruction: "Slowly release all the air out",
        guidance: "Blow out like blowing through a straw.",
        scale: 0.9,
      };
    case "rest":
      return {
        key: "rest",
        label: "Rest",
        instruction: "Rest quietly before the next breath",
        guidance: "Notice your weight against your seat.",
        scale: 1.0,
      };
  }
}

/**
 * Given total elapsed seconds, calculates the current cycle index (1-based),
 * the current phase, and the remaining countdown seconds inside the current phase.
 */
export function calculateBreathState(elapsedSeconds: number): {
  cycleIndex: number;
  phase: BreathPhase;
  secondsRemainingInPhase: number;
  phaseElapsedSeconds: number;
} {
  const safeElapsed = Math.max(0, elapsedSeconds);
  const cycleIndex = Math.floor(safeElapsed / CYCLE_DURATION) + 1;
  const secondInCycle = safeElapsed % CYCLE_DURATION;

  const phaseIndex = Math.floor(secondInCycle / PHASE_DURATION);
  const phase = PHASE_ORDER[Math.min(phaseIndex, PHASE_ORDER.length - 1)];

  const phaseElapsedSeconds = secondInCycle % PHASE_DURATION;
  const secondsRemainingInPhase = PHASE_DURATION - phaseElapsedSeconds;

  return {
    cycleIndex,
    phase,
    secondsRemainingInPhase: Math.max(1, Math.ceil(secondsRemainingInPhase)),
    phaseElapsedSeconds,
  };
}
