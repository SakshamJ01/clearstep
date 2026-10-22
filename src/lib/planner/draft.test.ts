import { describe, expect, it } from "vitest";
import { DraftContentError, normalizeDraftContent } from "@/lib/planner/draft";
import type { DraftContent, DraftTask } from "@/lib/schemas";

function task(id: string, overrides: Partial<DraftTask> = {}): DraftTask {
  return {
    id,
    title: `Task ${id}`,
    description: `Do the thing for ${id}.`,
    effortMin: 10,
    effortMax: 20,
    dependsOn: [],
    rationale: null,
    isAssumption: false,
    ...overrides,
  };
}

function content(overrides: Partial<DraftContent> = {}): DraftContent {
  return {
    title: "A valid plan",
    summary: "A short summary of the plan.",
    statedFacts: ["The plan matters."],
    assumptions: ["The steps are in a sensible order."],
    tasks: [task("a"), task("b"), task("c")],
    clarifyingQuestion: null,
    startHereTaskId: "a",
    ...overrides,
  };
}

describe("normalizeDraftContent", () => {
  it("keeps a clean draft intact", () => {
    const input = content({
      tasks: [task("a"), task("b", { dependsOn: ["a"] }), task("c")],
    });
    const normalized = normalizeDraftContent(input);

    expect(normalized.tasks[1]?.dependsOn).toEqual(["a"]);
    expect(normalized.startHereTaskId).toBe("a");
    expect(normalized.assumptions).toEqual(input.assumptions);
  });

  it("removes missing, duplicate, and self dependencies", () => {
    const input = content({
      tasks: [
        task("a", { dependsOn: ["a", "missing", "b", "b"] }),
        task("b"),
        task("c"),
      ],
    });
    const normalized = normalizeDraftContent(input);

    expect(normalized.tasks[0]?.dependsOn).toEqual(["b"]);
    expect(normalized.assumptions).toContain(
      "A suggested link between steps was removed because it could not form a clear sequence.",
    );
  });

  it("breaks cycles rather than accepting an impossible sequence", () => {
    const input = content({
      tasks: [
        task("a", { dependsOn: ["b"] }),
        task("b", { dependsOn: ["a"] }),
        task("c"),
      ],
    });
    const normalized = normalizeDraftContent(input);

    expect(normalized.tasks[0]?.dependsOn).toEqual([]);
    expect(normalized.tasks[1]?.dependsOn).toEqual([]);
    expect(normalized.assumptions).toContain(
      "A suggested link between steps was removed because it could not form a clear sequence.",
    );
  });

  it("falls back to the first task for a missing start id", () => {
    const normalized = normalizeDraftContent(
      content({ startHereTaskId: "not-a-task" }),
    );

    expect(normalized.startHereTaskId).toBe("a");
  });

  it("normalizes a blank clarifying question to null", () => {
    const normalized = normalizeDraftContent(
      content({ clarifyingQuestion: "   " }),
    );

    expect(normalized.clarifyingQuestion).toBeNull();
  });

  it("rejects duplicate task ids", () => {
    expect(() =>
      normalizeDraftContent(content({ tasks: [task("a"), task("a"), task("b")] })),
    ).toThrow(DraftContentError);
  });

  it("rejects content that does not fit the schema", () => {
    expect(() =>
      normalizeDraftContent(content({ tasks: [task("a"), task("b")] })),
    ).toThrow(DraftContentError);
  });
});
