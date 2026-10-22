import {
  draftContentSchema,
  type DraftContent,
  type DraftTask,
} from "@/lib/schemas";

export class DraftContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DraftContentError";
  }
}

function addAssumption(content: DraftContent, assumption: string): void {
  if (!content.assumptions.includes(assumption) && content.assumptions.length < 8) {
    content.assumptions.push(assumption);
  }
}

function resolveCycles(tasks: DraftTask[]): boolean {
  const ids = new Set(tasks.map((task) => task.id));
  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const task of tasks) {
    indegree.set(task.id, task.dependsOn.length);
    for (const dependency of task.dependsOn) {
      if (!ids.has(dependency)) continue;
      const list = dependents.get(dependency) ?? [];
      list.push(task.id);
      dependents.set(dependency, list);
    }
  }

  const queue = tasks
    .filter((task) => (indegree.get(task.id) ?? 0) === 0)
    .map((task) => task.id);
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    visited.add(current);
    for (const dependent of dependents.get(current) ?? []) {
      const next = (indegree.get(dependent) ?? 1) - 1;
      indegree.set(dependent, next);
      if (next === 0) queue.push(dependent);
    }
  }

  let changed = false;
  for (const task of tasks) {
    if (!visited.has(task.id) && task.dependsOn.length > 0) {
      task.dependsOn = [];
      changed = true;
    }
  }
  return changed;
}

export function normalizeDraftContent(raw: unknown): DraftContent {
  const parsed = draftContentSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DraftContentError("The draft did not match the expected format.");
  }

  const content = parsed.data;
  const tasks = content.tasks.map((task) => ({
    ...task,
    dependsOn: [...task.dependsOn],
  }));

  const ids = new Set<string>();
  for (const task of tasks) {
    if (ids.has(task.id)) {
      throw new DraftContentError("The draft used the same task id twice.");
    }
    ids.add(task.id);
  }

  let removedLinks = false;
  for (const task of tasks) {
    const cleaned: string[] = [];
    const seen = new Set<string>();
    for (const dependency of task.dependsOn) {
      if (dependency === task.id || !ids.has(dependency) || seen.has(dependency)) {
        removedLinks = true;
        continue;
      }
      seen.add(dependency);
      cleaned.push(dependency);
    }
    task.dependsOn = cleaned;
  }

  if (resolveCycles(tasks)) removedLinks = true;
  if (removedLinks) {
    addAssumption(
      content,
      "A suggested link between steps was removed because it could not form a clear sequence.",
    );
  }

  content.tasks = tasks;

  if (
    !content.startHereTaskId ||
    !tasks.some((task) => task.id === content.startHereTaskId)
  ) {
    content.startHereTaskId = tasks[0]?.id ?? null;
  }

  if (content.clarifyingQuestion?.trim() === "") {
    content.clarifyingQuestion = null;
  }

  return content;
}
