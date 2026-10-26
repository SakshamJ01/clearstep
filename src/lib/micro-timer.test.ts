import { describe, expect, it } from "vitest";
import {
  calculateProgressPercent,
  formatTimerSeconds,
  SPRINT_PRESETS,
} from "./micro-timer";

describe("micro-timer", () => {
  it("formats remaining seconds into MM:SS correctly", () => {
    expect(formatTimerSeconds(300)).toBe("05:00");
    expect(formatTimerSeconds(299)).toBe("04:59");
    expect(formatTimerSeconds(65)).toBe("01:05");
    expect(formatTimerSeconds(9)).toBe("00:09");
    expect(formatTimerSeconds(0)).toBe("00:00");
    expect(formatTimerSeconds(-5)).toBe("00:00");
  });

  it("calculates progress percentage correctly", () => {
    expect(calculateProgressPercent(300, 300)).toBe(0);
    expect(calculateProgressPercent(300, 150)).toBe(50);
    expect(calculateProgressPercent(300, 0)).toBe(100);
    expect(calculateProgressPercent(300, -10)).toBe(100);
  });

  it("provides valid presets including 5-minute default", () => {
    expect(SPRINT_PRESETS[0].minutes).toBe(5);
    expect(SPRINT_PRESETS[0].label).toBe("5 min");
    expect(SPRINT_PRESETS.length).toBe(3);
  });
});
