import type { TaskStatus } from "@/lib/schemas";

export interface ReplanTask {
  id: string;
  title: string;
  status: TaskStatus;
  sortOrder: number;
  effortMin: number | null;
  effortMax: number | null;
  dependsOn: string[];
}

export interface ReplanProposal {
  taskOrder: string[];
  startTaskId: string | null;
  horizonDate: string | null;
  availableMinutesPerWeek: number | null;
  summary: string;
  changes: string[];
  estimatedOpenMinutesMin: number;
  estimatedOpenMinutesMax: number;
  completedPreserved: true;
}

export interface ReplanInput {
  tasks: ReplanTask[];
  currentStartTaskId: string | null;
  currentHorizonDate: string | null;
  currentAvailableMinutesPerWeek: number | null;
  horizonDate: string | null;
  availableMinutesPerWeek: number | null;
}

function seconds(value: number): string {
  return `${value} minutes`;
}

function proposalOrder(tasks: ReplanTask[]): string[] {
  const pending = tasks.filter((task) => task.status !== "done");
  const pendingIds = new Set(pending.map((task) => task.id));
  const dependencies = new Map<string, string[]>();
  const dependents = new Map<string, string[]>();
  const indegree = new Map<string, number>();

  for (const task of pending) {
    const deps = task.dependsOn.filter(
      (dependency) => pendingIds.has(dependency) && dependency !== task.id,
    );
    dependencies.set(task.id, deps);
    indegree.set(task.id, deps.length);
    for (const dependency of deps) {
      const list = dependents.get(dependency) ?? [];
      list.push(task.id);
      dependents.set(dependency, list);
    }
  }

  const ready = pending
    .filter((task) => (indegree.get(task.id) ?? 0) === 0)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const byId = new Map(pending.map((task) => [task.id, task]));
  const order: string[] = [];

  while (ready.length > 0) {
    ready.sort((a, b) => {
      const dependentDiff =
        (dependents.get(b.id)?.length ?? 0) - (dependents.get(a.id)?.length ?? 0);
      if (dependentDiff !== 0) return dependentDiff;
      const effortDiff =
        (a.effortMin ?? Number.MAX_SAFE_INTEGER) -
        (b.effortMin ?? Number.MAX_SAFE_INTEGER);
      if (effortDiff !== 0) return effortDiff;
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.title.localeCompare(b.title);
    });

    const next = ready.shift()!;
    order.push(next.id);
    for (const dependentId of dependents.get(next.id) ?? []) {
      const remaining = (indegree.get(dependentId) ?? 1) - 1;
      indegree.set(dependentId, remaining);
      if (remaining === 0) {
        const dependent = byId.get(dependentId);
        if (dependent) ready.push(dependent);
      }
    }
  }

  if (order.length < pending.length) {
    const ordered = new Set(order);
    const leftovers = pending
      .filter((task) => !ordered.has(task.id))
      .sort((a, b) => a.sortOrder - b.sortOrder);
    for (const task of leftovers) order.push(task.id);
  }

  return order;
}

export function buildReplanProposal(input: ReplanInput): ReplanProposal {
  const pending = input.tasks.filter((task) => task.status !== "done");
  const completedCount = input.tasks.length - pending.length;
  const pendingIds = new Set(pending.map((task) => task.id));
  const newOrder = proposalOrder(input.tasks);

  const startCandidates = pending.filter((task) => {
    const unfinishedDependencies = task.dependsOn.filter((dependency) =>
      pendingIds.has(dependency),
    );
    return unfinishedDependencies.length === 0 && task.status !== "blocked";
  });
  const fallbackCandidates = pending.filter((task) => {
    const unfinishedDependencies = task.dependsOn.filter((dependency) =>
      pendingIds.has(dependency),
    );
    return unfinishedDependencies.length === 0;
  });
  const startPool =
    startCandidates.length > 0
      ? startCandidates
      : fallbackCandidates.length > 0
        ? fallbackCandidates
        : pending;
  const startTask =
    [...startPool].sort((a, b) => {
      const effortDiff =
        (a.effortMin ?? Number.MAX_SAFE_INTEGER) -
        (b.effortMin ?? Number.MAX_SAFE_INTEGER);
      if (effortDiff !== 0) return effortDiff;
      return newOrder.indexOf(a.id) - newOrder.indexOf(b.id);
    })[0] ?? null;

  const estimatedOpenMinutesMin = pending.reduce(
    (sum, task) => sum + (task.effortMin ?? 0),
    0,
  );
  const estimatedOpenMinutesMax = pending.reduce(
    (sum, task) => sum + (task.effortMax ?? 0),
    0,
  );

  const changes: string[] = [];
  if (input.horizonDate !== input.currentHorizonDate) {
    changes.push(
      input.horizonDate
        ? `Deadline set to ${input.horizonDate}.`
        : "Deadline removed.",
    );
  }
  if (
    input.availableMinutesPerWeek !== input.currentAvailableMinutesPerWeek
  ) {
    changes.push(
      input.availableMinutesPerWeek
        ? `Weekly time set to ${seconds(input.availableMinutesPerWeek)}.`
        : "Weekly time limit removed.",
    );
  }

  const currentOpenOrder = [...pending]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((task) => task.id);
  const orderChanged =
    currentOpenOrder.length === newOrder.length &&
    currentOpenOrder.some((id, index) => id !== newOrder[index]);
  if (pending.length > 0) {
    changes.push(
      orderChanged
        ? "Open tasks were re-sequenced to surface unblockers and smaller steps first."
        : "Open tasks are already in a workable order.",
    );
  }

  if (startTask && startTask.id !== input.currentStartTaskId) {
    changes.push(`Start here is now "${startTask.title}".`);
  } else if (startTask) {
    changes.push(`Kept "${startTask.title}" as the starting point.`);
  }

  if (pending.some((task) => task.status === "blocked")) {
    changes.push("Blocked tasks stay in the plan but are not chosen as the start.");
  }

  if (input.availableMinutesPerWeek && pending.length > 0) {
    const weeks =
      estimatedOpenMinutesMin === 0
        ? 0
        : Math.ceil(estimatedOpenMinutesMin / input.availableMinutesPerWeek);
    if (weeks > 0) {
      changes.push(
        `At ${seconds(input.availableMinutesPerWeek)} per week, the open work is at least ${weeks} ${
          weeks === 1 ? "week" : "weeks"
        } by its rough minimum estimate.`,
      );
    }
  }

  if (input.horizonDate && pending.length > 0) {
    const today = new Date();
    const deadline = new Date(`${input.horizonDate}T23:59:59.999Z`);
    const days = Math.ceil(
      (deadline.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
    );
    if (days < 0) {
      changes.push("The deadline is already in the past; update it before accepting.");
    } else if (input.availableMinutesPerWeek) {
      const capacity = Math.max(1, days) * (input.availableMinutesPerWeek / 7);
      if (estimatedOpenMinutesMin > capacity) {
        changes.push(
          `The open work is roughly ${estimatedOpenMinutesMin}–${estimatedOpenMinutesMax} minutes, but the time available before the deadline is about ${Math.round(
            capacity,
          )} minutes. The scope or the deadline needs to change.`,
        );
      } else {
        changes.push(
          "The rough estimate fits inside the time available before the deadline.",
        );
      }
    }
  }

  const summary =
    pending.length === 0
      ? "Everything is done. Re-planning will not touch completed work; you can still update the deadline or weekly time."
      : `This preview keeps all ${completedCount} completed ${
          completedCount === 1 ? "task" : "tasks"
        } untouched and proposes a new order for ${pending.length} open ${
          pending.length === 1 ? "task" : "tasks"
        }.`;

  return {
    taskOrder: newOrder,
    startTaskId: startTask?.id ?? null,
    horizonDate: input.horizonDate,
    availableMinutesPerWeek: input.availableMinutesPerWeek,
    summary,
    changes: changes.slice(0, 8),
    estimatedOpenMinutesMin,
    estimatedOpenMinutesMax,
    completedPreserved: true,
  };
}
