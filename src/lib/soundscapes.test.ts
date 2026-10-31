import { describe, expect, it } from "vitest";
import {
  DEFAULT_SOUNDSCAPE_VOLUME,
  generateBrownNoiseData,
  generatePinkNoiseData,
  getSoundscapeEngine,
  SOUNDSCAPE_OPTIONS,
  SoundscapeEngine,
  type SoundscapeType,
} from "./soundscapes";

describe("soundscapes module", () => {
  it("defines comprehensive soundscape options with emojis and descriptions", () => {
    const ids = SOUNDSCAPE_OPTIONS.map((opt) => opt.id);
    expect(ids).toContain("off");
    expect(ids).toContain("brown");
    expect(ids).toContain("rain");
    expect(ids).toContain("waves");
    expect(ids).toContain("alpha");

    for (const opt of SOUNDSCAPE_OPTIONS) {
      expect(opt.label.length).toBeGreaterThan(0);
      expect(opt.shortLabel.length).toBeGreaterThan(0);
      expect(opt.description.length).toBeGreaterThan(0);
      expect(opt.emoji.length).toBeGreaterThan(0);
    }
  });

  it("generates brown noise data with bounded range and valid variance", () => {
    const length = 2048;
    const data = generateBrownNoiseData(length);

    expect(data.length).toBe(length);
    let min = 1;
    let max = -1;
    let hasNonZero = false;

    for (let i = 0; i < length; i++) {
      const val = data[i];
      if (val < min) min = val;
      if (val > max) max = val;
      if (Math.abs(val) > 0.001) hasNonZero = true;
    }

    expect(hasNonZero).toBe(true);
    expect(min).toBeGreaterThanOrEqual(-1);
    expect(max).toBeLessThanOrEqual(1);
  });

  it("generates pink noise data with bounded range and valid variance", () => {
    const length = 2048;
    const data = generatePinkNoiseData(length);

    expect(data.length).toBe(length);
    let min = 1;
    let max = -1;
    let hasNonZero = false;

    for (let i = 0; i < length; i++) {
      const val = data[i];
      if (val < min) min = val;
      if (val > max) max = val;
      if (Math.abs(val) > 0.001) hasNonZero = true;
    }

    expect(hasNonZero).toBe(true);
    expect(min).toBeGreaterThanOrEqual(-1);
    expect(max).toBeLessThanOrEqual(1);
  });

  it("manages volume clamping and defaults cleanly in SoundscapeEngine", () => {
    const engine = new SoundscapeEngine();
    expect(engine.getVolume()).toBe(DEFAULT_SOUNDSCAPE_VOLUME);
    expect(engine.getActiveType()).toBe("off");

    engine.setVolume(0.8);
    expect(engine.getVolume()).toBe(0.8);

    // Clamping checks
    engine.setVolume(1.5);
    expect(engine.getVolume()).toBe(1);

    engine.setVolume(-0.2);
    expect(engine.getVolume()).toBe(0);
  });

  it("gracefully operates in non-browser/SSR environment without throwing", () => {
    const engine = new SoundscapeEngine();
    // In node test env, window.AudioContext may be undefined
    expect(() => {
      engine.play("brown" as SoundscapeType);
      engine.pause();
      engine.resume();
      engine.stop();
      engine.play("off");
    }).not.toThrow();
  });

  it("returns singleton instance via getSoundscapeEngine", () => {
    const instance1 = getSoundscapeEngine();
    const instance2 = getSoundscapeEngine();
    expect(instance1).toBe(instance2);
  });
});
