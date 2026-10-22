import { describe, expect, it } from "vitest";
import { draftContentSchema } from "@/lib/schemas";
import { buildManualDraft } from "@/lib/planner/manual";

const baseInput = {
  outcome: "Get the flat admin under control",
  horizonDate: null,
  availableMinutesPerWeek: null,
  constraints: null,
};

describe("buildManualDraft", () => {
  it("turns distinct dump lines into a valid draft", () => {
    const draft = buildManualDraft({
      ...baseInput,
      dump: [
        "- Email the landlord about the broken window",
        "- Call the dentist and book a check-up",
        "- Collect the deposit paperwork from the drawer",
        "- Ask Sam for the rent split",
      ].join("\n"),
    });

    expect(draftContentSchema.safeParse(draft).success).toBe(true);
    expect(draft.tasks).toHaveLength(4);
    expect(draft.tasks[0]?.title).toBe(
      "Email the landlord about the broken window",
    );
    expect(draft.tasks.every((task) => task.dependsOn.length === 0)).toBe(true);
    expect(draft.startHereTaskId).toBe(draft.tasks[0]?.id);
    expect(draft.assumptions).toContain(
      "This is a manual draft: Clearstep grouped your own words and did not use AI.",
    );
  });

  it("adds starter tasks until there are at least three", () => {
    const draft = buildManualDraft({
      ...baseInput,
      dump: "Buy milk",
    });

    expect(draftContentSchema.safeParse(draft).success).toBe(true);
    expect(draft.tasks).toHaveLength(3);
    expect(draft.tasks[0]?.title).toBe("Buy milk");
    expect(draft.tasks.slice(1).every((task) => task.isAssumption)).toBe(true);
    expect(draft.assumptions).toContain(
      "Tasks marked as suggestions are starter prompts, not things you explicitly wrote.",
    );
  });

  it("skips emotional preamble and duplicate items", () => {
    const draft = buildManualDraft({
      ...baseInput,
      dump: [
        "I feel completely overwhelmed.",
        "I don't know where to start.",
        "Call the dentist",
        "call the dentist!!!",
        "Open the brown envelope",
        "Send the form back",
      ].join("\n"),
    });

    expect(draft.tasks).toHaveLength(3);
    expect(draft.tasks.map((task) => task.title)).toEqual([
      "Call the dentist",
      "Open the brown envelope",
      "Send the form back",
    ]);
  });

  it("records planning context as stated facts", () => {
    const draft = buildManualDraft({
      ...baseInput,
      dump: "Write the draft\nEdit the draft\nSend the draft",
      horizonDate: "2026-12-01",
      availableMinutesPerWeek: 90,
      constraints: "Only after 8pm",
    });

    expect(draft.statedFacts).toContain("Deadline: 2026-12-01");
    expect(draft.statedFacts).toContain("Available time: 1.5 hours per week");
    expect(draft.statedFacts).toContain("Constraints: Only after 8pm");
    expect(draft.clarifyingQuestion).toBeNull();
  });

  it("groups items beyond the first ten instead of dropping them", () => {
    const dump = Array.from(
      { length: 12 },
      (_, index) => `Finish item number ${index + 1}`,
    ).join("\n");
    const draft = buildManualDraft({ ...baseInput, dump });

    expect(draftContentSchema.safeParse(draft).success).toBe(true);
    expect(draft.tasks).toHaveLength(11);
    expect(draft.tasks[10]?.title).toContain("Triage the rest of your dump");
    expect(draft.tasks[10]?.description).toContain("Finish item number 12");
  });
});
