import { describe, expect, it } from "vitest";
import { formatSpokenChunk } from "@/lib/use-voice-dictation";

describe("formatSpokenChunk", () => {
  it("formats first spoken chunk as a clean capitalized bullet point", () => {
    const result = formatSpokenChunk("", "call the dentist tomorrow");
    expect(result).toBe("• Call the dentist tomorrow");
  });

  it("appends subsequent spoken chunks on a new bullet line", () => {
    const initial = "• Call the dentist tomorrow";
    const result = formatSpokenChunk(initial, "renew passport before next month");
    expect(result).toBe(
      "• Call the dentist tomorrow\n• Renew passport before next month",
    );
  });

  it("trims extraneous whitespace while preserving existing dump content", () => {
    const existing = "Some notes already typed here.\n";
    const result = formatSpokenChunk(existing, "   ask Sam about rent split   ");
    expect(result).toBe(
      "Some notes already typed here.\n• Ask Sam about rent split",
    );
  });

  it("handles empty or whitespace-only spoken chunks without corrupting text", () => {
    const existing = "• Existing note";
    expect(formatSpokenChunk(existing, "")).toBe(existing);
    expect(formatSpokenChunk(existing, "   ")).toBe(existing);
  });
});
