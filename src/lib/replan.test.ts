import { describe, expect, it } from "vitest";
import { buildReplanProposal, type ReplanTask } from "@/lib/replan";

function task(
  id: string,
  overrides: Partial<ReplanTask> = {},
): ReplanTask {
  return {
    id,
    title: `Task ${id}`,
    status: "not_started",
    sortOrder: 0,
    effortMin: 15,
    effortMax: 30,
    dependsOn: [],
    ...overrides,
  };
}

const baseInput = {
  tasks: [] as ReplanTask[],
  currentStartTaskId: null,
  currentHorizonDate: null,
  currentAvailableMinutesPerWeek: null,
  horizonDate: null,
  availableMinutesPerWeek: null,
};

describe("buildReplanProposal", () => {
  it("keeps completed tasks out of the proposed order", () => {
    const proposal = buildReplanProposal({
      ...baseInput,
      tasks: [
        task("done", { status: "done", sortOrder: 0 }),
        task("open-b", { sortOrder: 2 }),
        task("open-a", { sortOrder: 1 }),
      ],
    });

    expect(proposal.taskOrder).toEqual(["open-a", "open-b"]);
    expect(proposal.completedPreserved).toBe(true);
    expect(proposal.summary).toContain("1 completed task");
  });

  it("orders dependencies before their dependents", () => {
    const proposal = buildReplanProposal({
      ...baseInput,
      tasks: [
        task("later", { dependsOn: ["first"], sortOrder: 0, effortMin: 5 }),
        task("first", { sortOrder: 1, effortMin: 60 }),
        task("other", { sortOrder: 2, effortMin: 20 }),
      ],
    });

    expect(proposal.taskOrder.indexOf("first")).toBeLessThan(
      proposal.taskOrder.indexOf("later"),
    );
    expect(proposal.startTaskId).not.toBe("later");
  });

  it("chooses a small unblocked task and avoids blocked work", () => {
    const proposal = buildReplanProposal({
      ...baseInput,
      currentStartTaskId: "large",
      tasks: [
        task("large", { effortMin: 60, sortOrder: 1 }),
        task("blocked", { effortMin: 5, status: "blocked", sortOrder: 2 }),
        task("small", { effortMin: 10, sortOrder: 3 }),
      ],
    });

    expect(proposal.startTaskId).toBe("small");
    expect(proposal.changes).toContain(
      'Blocked tasks stay in the plan but are not chosen as the start.',
    );
    expect(proposal.changes).toContain('Start here is now "Task small".');
  });

  it("estimates remaining effort using open tasks only", () => {
    const proposal = buildReplanProposal({
      ...baseInput,
      tasks: [
        task("done", { status: "done", effortMin: 100, effortMax: 120 }),
        task("a", { effortMin: 10, effortMax: 20 }),
        task("b", { effortMin: 15, effortMax: 25 }),
      ],
    });

    expect(proposal.estimatedOpenMinutesMin).toBe(25);
    expect(proposal.estimatedOpenMinutesMax).toBe(45);
  });

  it("reports deadline and weekly-time changes", () => {
    const proposal = buildReplanProposal({
      ...baseInput,
      tasks: [task("a")],
      currentHorizonDate: "2026-11-01",
      horizonDate: "2026-12-01",
      currentAvailableMinutesPerWeek: 90,
      availableMinutesPerWeek: 120,
    });

    expect(proposal.changes).toContain("Deadline set to 2026-12-01.");
    expect(proposal.changes).toContain("Weekly time set to 120 minutes.");
    expect(proposal.horizonDate).toBe("2026-12-01");
    expect(proposal.availableMinutesPerWeek).toBe(120);
  });

  it("handles an all-complete plan without inventing a start task", () => {
    const proposal = buildReplanProposal({
      ...baseInput,
      tasks: [
        task("a", { status: "done" }),
        task("b", { status: "done" }),
      ],
    });

    expect(proposal.taskOrder).toEqual([]);
    expect(proposal.startTaskId).toBeNull();
    expect(proposal.summary).toContain("Everything is done.");
    expect(proposal.changes.some((change) => change.startsWith("Start here"))).toBe(
      false,
    );
  });

  it("still surfaces cyclic tasks in a stable fallback order", () => {
    const proposal = buildReplanProposal({
      ...baseInput,
      tasks: [
        task("a", { dependsOn: ["b"], sortOrder: 2 }),
        task("b", { dependsOn: ["a"], sortOrder: 1 }),
      ],
    });

    expect(proposal.taskOrder).toEqual(["b", "a"]);
    expect(proposal.startTaskId).not.toBeNull();
  });
});
