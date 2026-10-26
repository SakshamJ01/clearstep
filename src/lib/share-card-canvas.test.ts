import { describe, expect, it } from "vitest";
import {
  buildShareText,
  THEMES,
  wrapCanvasText,
  type ShareCardData,
} from "./share-card-canvas";

describe("share-card-canvas", () => {
  it("provides valid configurations for forest, acid, and obsidian themes", () => {
    expect(THEMES.forest.name).toBe("Deep Forest");
    expect(THEMES.acid.name).toBe("Minimal Acid");
    expect(THEMES.obsidian.name).toBe("Midnight Obsidian");

    for (const key of Object.keys(THEMES) as Array<keyof typeof THEMES>) {
      const theme = THEMES[key];
      expect(theme.background).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(theme.accent).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("builds formatted share text including steps when hideTaskTitles is false", () => {
    const data: ShareCardData = {
      title: "Sort out apartment move",
      desiredOutcome: "Moving day calm and packed",
      totalTasks: 3,
      completedTasks: 3,
      tasks: [
        { title: "Book moving van", status: "done" },
        { title: "Pack kitchen boxes", status: "done" },
        { title: "Forward mail address", status: "done" },
      ],
      hideTaskTitles: false,
    };

    const text = buildShareText(data);
    expect(text).toContain('Outcome: "Moving day calm and packed"');
    expect(text).toContain("100% Completed!");
    expect(text).toContain("✅ Book moving van");
    expect(text).toContain("https://clearstep.app");
  });

  it("builds formatted share text without steps when hideTaskTitles is true", () => {
    const data: ShareCardData = {
      title: "Confidential Project",
      desiredOutcome: "Launch stealth feature",
      totalTasks: 5,
      completedTasks: 2,
      tasks: [
        { title: "Internal secret spec", status: "done" },
        { title: "Private partner NDA", status: "done" },
      ],
      hideTaskTitles: true,
    };

    const text = buildShareText(data);
    expect(text).toContain('Outcome: "Launch stealth feature"');
    expect(text).toContain("2/5 steps completed (40%)");
    expect(text).not.toContain("Internal secret spec");
  });

  it("wraps text into multiple lines based on canvas measureText mock", () => {
    // Mock 2D context
    const mockCtx = {
      measureText: (text: string) => ({
        width: text.length * 10,
      }),
    } as unknown as CanvasRenderingContext2D;

    const longText = "This is a long sentence that needs to wrap across multiple lines";
    const lines = wrapCanvasText(mockCtx, longText, 150);

    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(" ")).toBe(longText);
  });
});
