import { describe, expect, it } from "vitest";
import {
  calculateBreathState,
  CYCLE_DURATION,
  getNextPhase,
  getPhaseDetails,
  PHASE_DURATION,
} from "./breathing";

describe("breathing utility", () => {
  it("rotates phases in standard box order (inhale -> hold-in -> exhale -> rest -> inhale)", () => {
    expect(getNextPhase("inhale")).toBe("hold-in");
    expect(getNextPhase("hold-in")).toBe("exhale");
    expect(getNextPhase("exhale")).toBe("rest");
    expect(getNextPhase("rest")).toBe("inhale");
  });

  it("provides instructional guidance and scale for each phase", () => {
    const inhale = getPhaseDetails("inhale");
    expect(inhale.label).toBe("Inhale");
    expect(inhale.scale).toBeGreaterThan(1);

    const hold = getPhaseDetails("hold-in");
    expect(hold.label).toBe("Hold");

    const exhale = getPhaseDetails("exhale");
    expect(exhale.label).toBe("Exhale");
    expect(exhale.scale).toBeLessThan(1);

    const rest = getPhaseDetails("rest");
    expect(rest.label).toBe("Rest");
    expect(rest.scale).toBe(1.0);
  });

  it("calculates accurate phase, countdown, and cycle index across elapsed seconds", () => {
    // Second 0 (Start of Inhale)
    const s0 = calculateBreathState(0);
    expect(s0.cycleIndex).toBe(1);
    expect(s0.phase).toBe("inhale");
    expect(s0.secondsRemainingInPhase).toBe(4);

    // Second 3.5 (End of Inhale)
    const s3 = calculateBreathState(3);
    expect(s3.cycleIndex).toBe(1);
    expect(s3.phase).toBe("inhale");
    expect(s3.secondsRemainingInPhase).toBe(1);

    // Second 4 (Start of Hold-in)
    const s4 = calculateBreathState(4);
    expect(s4.cycleIndex).toBe(1);
    expect(s4.phase).toBe("hold-in");
    expect(s4.secondsRemainingInPhase).toBe(4);

    // Second 8 (Start of Exhale)
    const s8 = calculateBreathState(8);
    expect(s8.cycleIndex).toBe(1);
    expect(s8.phase).toBe("exhale");
    expect(s8.secondsRemainingInPhase).toBe(4);

    // Second 12 (Start of Rest)
    const s12 = calculateBreathState(12);
    expect(s12.cycleIndex).toBe(1);
    expect(s12.phase).toBe("rest");
    expect(s12.secondsRemainingInPhase).toBe(4);

    // Second 16 (Start of Cycle 2 Inhale)
    const s16 = calculateBreathState(16);
    expect(s16.cycleIndex).toBe(2);
    expect(s16.phase).toBe("inhale");
    expect(s16.secondsRemainingInPhase).toBe(4);

    // Second 33 (Cycle 3, 1 second into cycle = inhale)
    const s33 = calculateBreathState(CYCLE_DURATION * 2 + 1);
    expect(s33.cycleIndex).toBe(3);
    expect(s33.phase).toBe("inhale");
  });
});
