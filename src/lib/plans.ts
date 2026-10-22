import "server-only";

import type Database from "better-sqlite3";
import { ApiError } from "@/lib/api";
import { TASK_MAX } from "@/lib/constants";
import { getDb, nowIso } from "@/lib/db";
import type { DraftRecord } from "@/lib/drafts";
import type {
  DraftContent,
  GenerationMode,
  PlanStatus,
  TaskCreateInput,
  TaskStatus,
} from "@/lib/schemas";
import {
  taskCreateSchema,
  taskOrderSchema,
  taskPatchSchema,
} from "@/lib/schemas";
import {
  decryptText,
  encryptText,
  randomId,
} from "@/lib/secrets";

interface PlanRow {
  id: string;
  user_id: string;
  title: string;
  desired_outcome: string;
  horizon_date: string | null;
  available_minutes_per_week: number | null;
  constraints_text: string | null;
  source_dump: string | null;
  status: PlanStatus;
  generation_mode: GenerationMode;
  start_task_id: string | null;
  created_at: string;
  updated_at: string;
}

interface TaskRow {
  id: string;
  plan_id: string;
  title: string;
  description: string;
  effort_min: number | null;
  effort_max: number | null;
  status: TaskStatus;
  sort_order: number;
  rationale: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface DependencyRow {
  task_id: string;
  depends_on_task_id: string;
  depends_on_title: string;
  depends_on_status: TaskStatus;
}

interface SummaryRow {
  id: string;
  title: string;
  desired_outcome: string;
  status: PlanStatus;
  generation_mode: GenerationMode;
  horizon_date: string | null;
  available_minutes_per_week: number | null;
  created_at: string;
  updated_at: string;
  total_tasks: number;
  done_tasks: number;
}

export interface TaskDependencyView {
  id: string;
  title: string;
  status: TaskStatus;
}

export interface TaskView {
  id: string;
  title: string;
  description: string;
  effortMin: number | null;
  effortMax: number | null;
  status: TaskStatus;
  sortOrder: number;
  rationale: string | null;
  note: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  dependsOn: TaskDependencyView[];
  waitingOn: string[];
}

export interface PlanDetail {
  id: string;
  title: string;
  desiredOutcome: string;
  horizonDate: string | null;
  availableMinutesPerWeek: number | null;
  constraints: string;
  status: PlanStatus;
  generationMode: GenerationMode;
  startTaskId: string | null;
  createdAt: string;
  updatedAt: string;
  hasRawDump: boolean;
  tasks: TaskView[];
  assumptions: string[];
  totalTasks: number;
  doneTasks: number;
  progressPercent: number;
  nextTaskId: string | null;
  waitingCount: number;
}

export interface PlanSummary {
  id: string;
  title: string;
  desiredOutcome: string;
  status: PlanStatus;
  generationMode: GenerationMode;
  horizonDate: string | null;
  availableMinutesPerWeek: number | null;
  createdAt: string;
  updatedAt: string;
  totalTasks: number;
  doneTasks: number;
  progressPercent: number;
}

function parseStringArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 8);
  } catch {
    return [];
  }
}

function loadTaskViews(planId: string): TaskView[] {
  const db = getDb();
  const taskRows = db
    .prepare(
      "SELECT * FROM tasks WHERE plan_id = ? ORDER BY sort_order ASC, created_at ASC",
    )
    .all(planId) as TaskRow[];

  const dependencyRows = db
    .prepare(
      `SELECT d.task_id, d.depends_on_task_id,
              dependency.title AS depends_on_title,
              dependency.status AS depends_on_status
       FROM task_dependencies d
       JOIN tasks dependency ON dependency.id = d.depends_on_task_id
       JOIN tasks task ON task.id = d.task_id
       WHERE task.plan_id = ?`,
    )
    .all(planId) as DependencyRow[];

  const dependenciesByTask = new Map<string, TaskDependencyView[]>();
  for (const row of dependencyRows) {
    const list = dependenciesByTask.get(row.task_id) ?? [];
    list.push({
      id: row.depends_on_task_id,
      title: row.depends_on_title,
      status: row.depends_on_status,
    });
    dependenciesByTask.set(row.task_id, list);
  }

  return taskRows.map((row) => {
    const dependsOn = dependenciesByTask.get(row.id) ?? [];
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      effortMin: row.effort_min,
      effortMax: row.effort_max,
      status: row.status,
      sortOrder: row.sort_order,
      rationale: row.rationale,
      note: decryptText(row.note),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
      dependsOn,
      waitingOn: dependsOn
        .filter((dependency) => dependency.status !== "done")
        .map((dependency) => dependency.title),
    };
  });
}

function getAssumptions(planId: string): string[] {
  const row = getDb()
    .prepare(
      `SELECT assumptions_json FROM plan_revisions
       WHERE plan_id = ? AND status = 'accepted'
       ORDER BY revision_number DESC LIMIT 1`,
    )
    .get(planId) as { assumptions_json: string } | undefined;
  return row ? parseStringArray(row.assumptions_json) : [];
}

export function getPlanDetail(
  planId: string,
  userId: string,
): PlanDetail | null {
  const plan = getDb()
    .prepare("SELECT * FROM plans WHERE id = ? AND user_id = ?")
    .get(planId, userId) as PlanRow | undefined;
  if (!plan) return null;

  const tasks = loadTaskViews(plan.id);
  const doneTasks = tasks.filter((task) => task.status === "done").length;
  const totalTasks = tasks.length;
  const doneIds = new Set(
    tasks.filter((task) => task.status === "done").map((task) => task.id),
  );
  const openTasks = tasks
    .filter((task) => task.status !== "done")
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const actionable = openTasks.filter(
    (task) =>
      task.status !== "blocked" &&
      task.dependsOn.every((dependency) => doneIds.has(dependency.id)),
  );
  const preferred =
    plan.start_task_id && actionable.some((task) => task.id === plan.start_task_id)
      ? plan.start_task_id
      : null;
  const nextTaskId = preferred ?? actionable[0]?.id ?? null;
  const waitingCount = openTasks.filter((task) =>
    task.dependsOn.some((dependency) => !doneIds.has(dependency.id)),
  ).length;

  return {
    id: plan.id,
    title: plan.title,
    desiredOutcome: plan.desired_outcome,
    horizonDate: plan.horizon_date,
    availableMinutesPerWeek: plan.available_minutes_per_week,
    constraints: decryptText(plan.constraints_text),
    status: plan.status,
    generationMode: plan.generation_mode,
    startTaskId: plan.start_task_id,
    createdAt: plan.created_at,
    updatedAt: plan.updated_at,
    hasRawDump: Boolean(plan.source_dump),
    tasks,
    assumptions: getAssumptions(plan.id),
    totalTasks,
    doneTasks,
    progressPercent:
      totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100),
    nextTaskId,
    waitingCount,
  };
}

export function getPlansForUser(userId: string): PlanSummary[] {
  const rows = getDb()
    .prepare(
      `SELECT p.id, p.title, p.desired_outcome, p.status, p.generation_mode,
              p.horizon_date, p.available_minutes_per_week,
              p.created_at, p.updated_at,
              COUNT(t.id) AS total_tasks,
              COALESCE(SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END), 0)
                AS done_tasks
       FROM plans p
       LEFT JOIN tasks t ON t.plan_id = p.id
       WHERE p.user_id = ?
       GROUP BY p.id
       ORDER BY p.updated_at DESC`,
    )
    .all(userId) as SummaryRow[];

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    desiredOutcome: row.desired_outcome,
    status: row.status,
    generationMode: row.generation_mode,
    horizonDate: row.horizon_date,
    availableMinutesPerWeek: row.available_minutes_per_week,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    totalTasks: row.total_tasks,
    doneTasks: row.done_tasks,
    progressPercent:
      row.total_tasks === 0
        ? 0
        : Math.round((row.done_tasks / row.total_tasks) * 100),
  }));
}

export function createApprovedPlan(
  draft: DraftRecord,
  content: DraftContent,
): string {
  const db = getDb();
  if (draft.approvedPlanId) {
    const existing = db
      .prepare("SELECT id FROM plans WHERE id = ? AND user_id = ?")
      .get(draft.approvedPlanId, draft.userId) as { id: string } | undefined;
    if (existing) return existing.id;
  }

  const transaction = db.transaction(() => {
    const timestamp = nowIso();
    const planId = randomId();
    const idMap = new Map<string, string>();
    for (const task of content.tasks) {
      idMap.set(task.id, randomId());
    }
    const firstTaskId = content.tasks[0]
      ? idMap.get(content.tasks[0].id)
      : null;
    const startTaskId =
      (content.startHereTaskId && idMap.get(content.startHereTaskId)) ||
      firstTaskId;

    db.prepare(
      `INSERT INTO plans (
        id, user_id, title, desired_outcome, horizon_date,
        available_minutes_per_week, constraints_text, source_dump,
        status, generation_mode, start_task_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
    ).run(
      planId,
      draft.userId,
      content.title,
      draft.outcome,
      draft.horizonDate,
      draft.availableMinutesPerWeek,
      encryptText(draft.constraints),
      encryptText(draft.dump),
      draft.mode,
      startTaskId,
      timestamp,
      timestamp,
    );

    const insertTask = db.prepare(
      `INSERT INTO tasks (
        id, plan_id, title, description, effort_min, effort_max,
        status, sort_order, rationale, note, created_at, updated_at,
        completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'not_started', ?, ?, NULL, ?, ?, NULL)`,
    );
    content.tasks.forEach((task, index) => {
      insertTask.run(
        idMap.get(task.id),
        planId,
        task.title,
        task.description,
        task.effortMin,
        task.effortMax,
        (index + 1) * 10,
        task.rationale,
        timestamp,
        timestamp,
      );
    });

    const insertDependency = db.prepare(
      `INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_task_id)
       VALUES (?, ?)`,
    );
    for (const task of content.tasks) {
      const taskId = idMap.get(task.id);
      if (!taskId) continue;
      for (const dependency of task.dependsOn) {
        const dependencyId = idMap.get(dependency);
        if (dependencyId && dependencyId !== taskId) {
          insertDependency.run(taskId, dependencyId);
        }
      }
    }

    db.prepare(
      `INSERT INTO plan_revisions (
        id, plan_id, revision_number, status, assumptions_json,
        changes_json, payload_json, model_version, created_at, accepted_at
      ) VALUES (?, ?, 1, 'accepted', ?, '[]', ?, ?, ?, ?)`,
    ).run(
      randomId(),
      planId,
      JSON.stringify(content.assumptions),
      JSON.stringify({
        kind: "initial",
        generationMode: draft.mode,
        taskCount: content.tasks.length,
      }),
      draft.modelName,
      timestamp,
      timestamp,
    );

    db.prepare(
      `UPDATE plan_drafts
       SET approved_plan_id = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
    ).run(planId, timestamp, draft.id, draft.userId);

    return planId;
  });

  return transaction();
}

function recalculatePlanStatus(planId: string, db: Database.Database): void {
  const plan = db
    .prepare("SELECT status FROM plans WHERE id = ?")
    .get(planId) as { status: PlanStatus } | undefined;
  if (!plan || plan.status === "archived") return;

  const counts = db
    .prepare(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END), 0)
                AS done
       FROM tasks WHERE plan_id = ?`,
    )
    .get(planId) as { total: number; done: number };

  const shouldBeCompleted = counts.total > 0 && counts.done === counts.total;
  const nextStatus: PlanStatus = shouldBeCompleted ? "completed" : "active";
  if (nextStatus !== plan.status) {
    db.prepare("UPDATE plans SET status = ?, updated_at = ? WHERE id = ?").run(
      nextStatus,
      nowIso(),
      planId,
    );
  }
}

export function addTaskForUser(
  planId: string,
  userId: string,
  input: TaskCreateInput,
): { taskId: string; sortOrder: number } | null {
  const parsed = taskCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new ApiError(
      400,
      "VALIDATION",
      parsed.error.issues[0]?.message || "Check the task fields.",
    );
  }
  const values = parsed.data;
  const db = getDb();
  const plan = db
    .prepare("SELECT id, status FROM plans WHERE id = ? AND user_id = ?")
    .get(planId, userId) as { id: string; status: PlanStatus } | undefined;
  if (!plan) return null;
  if (plan.status === "archived") {
    throw new ApiError(
      409,
      "PLAN_ARCHIVED",
      "Restore this plan before adding tasks.",
    );
  }

  const timestamp = nowIso();
  const taskId = randomId();
  const transaction = db.transaction(() => {
    const count = db
      .prepare("SELECT COUNT(*) AS count FROM tasks WHERE plan_id = ?")
      .get(planId) as { count: number };
    if (count.count >= TASK_MAX) {
      throw new ApiError(
        409,
        "TASK_LIMIT",
        `A plan can have at most ${TASK_MAX} tasks.`,
      );
    }
    const max = db
      .prepare(
        "SELECT COALESCE(MAX(sort_order), 0) AS max FROM tasks WHERE plan_id = ?",
      )
      .get(planId) as { max: number };
    const sortOrder = max.max + 10;

    const dependencies = Array.from(new Set(values.dependsOn ?? [])).filter(
      (dependencyId) => {
        const row = db
          .prepare("SELECT 1 AS ok FROM tasks WHERE id = ? AND plan_id = ?")
          .get(dependencyId, planId) as { ok: number } | undefined;
        return Boolean(row) && dependencyId !== taskId;
      },
    );

    db.prepare(
      `INSERT INTO tasks (
        id, plan_id, title, description, effort_min, effort_max,
        status, sort_order, rationale, note, created_at, updated_at,
        completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'not_started', ?, NULL, ?, ?, ?, NULL)`,
    ).run(
      taskId,
      planId,
      values.title,
      values.description,
      values.effortMin,
      values.effortMax,
      sortOrder,
      encryptText(values.note ?? null),
      timestamp,
      timestamp,
    );

    const insertDependency = db.prepare(
      `INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_task_id)
       VALUES (?, ?)`,
    );
    for (const dependencyId of dependencies) {
      insertDependency.run(taskId, dependencyId);
    }

    db.prepare("UPDATE plans SET updated_at = ? WHERE id = ?").run(
      timestamp,
      planId,
    );
    recalculatePlanStatus(planId, db);
    return sortOrder;
  });

  const sortOrder = transaction();
  return { taskId, sortOrder };
}

export function reorderTasksForUser(
  planId: string,
  userId: string,
  input: unknown,
): { reordered: number } | null {
  const parsed = taskOrderSchema.safeParse(input);
  if (!parsed.success) {
    throw new ApiError(
      400,
      "VALIDATION",
      parsed.error.issues[0]?.message || "Check the task order.",
    );
  }

  const db = getDb();
  const plan = db
    .prepare("SELECT id, status FROM plans WHERE id = ? AND user_id = ?")
    .get(planId, userId) as { id: string; status: PlanStatus } | undefined;
  if (!plan) return null;
  if (plan.status === "archived") {
    throw new ApiError(
      409,
      "PLAN_ARCHIVED",
      "Restore this plan before reordering tasks.",
    );
  }

  const existing = db
    .prepare("SELECT id FROM tasks WHERE plan_id = ?")
    .all(planId) as Array<{ id: string }>;
  const existingIds = new Set(existing.map((task) => task.id));
  if (parsed.data.taskIds.some((taskId) => !existingIds.has(taskId))) {
    throw new ApiError(
      400,
      "INVALID_TASK_ORDER",
      "The task order included a task that is not in this plan.",
    );
  }

  const timestamp = nowIso();
  const transaction = db.transaction(() => {
    const update = db.prepare(
      "UPDATE tasks SET sort_order = ?, updated_at = ? WHERE id = ? AND plan_id = ?",
    );
    parsed.data.taskIds.forEach((taskId, index) => {
      update.run((index + 1) * 10, timestamp, taskId, planId);
    });
    db.prepare("UPDATE plans SET updated_at = ? WHERE id = ?").run(
      timestamp,
      planId,
    );
  });
  transaction();

  return { reordered: parsed.data.taskIds.length };
}

export function updateTaskForUser(
  taskId: string,
  userId: string,
  patch: unknown,
): { planId: string } | null {
  const parsed = taskPatchSchema.safeParse(patch);
  if (!parsed.success) {
    throw new ApiError(
      400,
      "VALIDATION",
      parsed.error.issues[0]?.message || "Check the task fields.",
    );
  }
  const values = parsed.data;
  const db = getDb();
  const row = db
    .prepare(
      `SELECT t.*, p.status AS plan_status
       FROM tasks t JOIN plans p ON p.id = t.plan_id
       WHERE t.id = ? AND p.user_id = ?`,
    )
    .get(taskId, userId) as (TaskRow & { plan_status: PlanStatus }) | undefined;
  if (!row) return null;
  if (row.plan_status === "archived") {
    throw new ApiError(
      409,
      "PLAN_ARCHIVED",
      "This plan is archived. Restore it before making changes.",
    );
  }

  const effortMin =
    values.effortMin !== undefined ? values.effortMin : row.effort_min;
  const effortMax =
    values.effortMax !== undefined ? values.effortMax : row.effort_max;
  if (
    effortMin !== null &&
    effortMax !== null &&
    effortMin !== undefined &&
    effortMax !== undefined &&
    effortMin > effortMax
  ) {
    throw new ApiError(
      400,
      "VALIDATION",
      "Maximum effort must be at least the minimum.",
      { fields: { effortMax: "Maximum effort must be at least the minimum." } },
    );
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  if (values.title !== undefined) {
    updates.push("title = ?");
    params.push(values.title);
  }
  if (values.description !== undefined) {
    updates.push("description = ?");
    params.push(values.description);
  }
  if (values.effortMin !== undefined) {
    updates.push("effort_min = ?");
    params.push(values.effortMin);
  }
  if (values.effortMax !== undefined) {
    updates.push("effort_max = ?");
    params.push(values.effortMax);
  }
  if (values.sortOrder !== undefined) {
    updates.push("sort_order = ?");
    params.push(values.sortOrder);
  }
  if (values.note !== undefined) {
    updates.push("note = ?");
    params.push(encryptText(values.note || null));
  }
  if (values.status !== undefined) {
    updates.push("status = ?");
    params.push(values.status);
    if (values.status === "done") {
      if (!row.completed_at) {
        updates.push("completed_at = ?");
        params.push(nowIso());
      }
    } else {
      updates.push("completed_at = NULL");
    }
  }

  updates.push("updated_at = ?");
  params.push(nowIso());
  params.push(taskId);

  const transaction = db.transaction(() => {
    db.prepare(
      `UPDATE tasks SET ${updates.join(", ")} WHERE id = ?`,
    ).run(...params);
    db.prepare("UPDATE plans SET updated_at = ? WHERE id = ?").run(
      nowIso(),
      row.plan_id,
    );
    recalculatePlanStatus(row.plan_id, db);
  });
  transaction();
  return { planId: row.plan_id };
}

export function deleteTaskForUser(
  taskId: string,
  userId: string,
): { planId: string } | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT t.id, t.plan_id, p.status AS plan_status, p.start_task_id
       FROM tasks t JOIN plans p ON p.id = t.plan_id
       WHERE t.id = ? AND p.user_id = ?`,
    )
    .get(taskId, userId) as
    | {
        id: string;
        plan_id: string;
        plan_status: PlanStatus;
        start_task_id: string | null;
      }
    | undefined;
  if (!row) return null;
  if (row.plan_status === "archived") {
    throw new ApiError(
      409,
      "PLAN_ARCHIVED",
      "This plan is archived. Restore it before making changes.",
    );
  }

  const transaction = db.transaction(() => {
    db.prepare("DELETE FROM tasks WHERE id = ?").run(taskId);
    if (row.start_task_id === taskId) {
      db.prepare("UPDATE plans SET start_task_id = NULL WHERE id = ?").run(
        row.plan_id,
      );
    }
    db.prepare("UPDATE plans SET updated_at = ? WHERE id = ?").run(
      nowIso(),
      row.plan_id,
    );
    recalculatePlanStatus(row.plan_id, db);
  });
  transaction();
  return { planId: row.plan_id };
}

export function updatePlanRecord(
  planId: string,
  userId: string,
  patch: {
    title?: string;
    horizonDate?: string | null;
    availableMinutesPerWeek?: number | null;
    status?: "active" | "archived";
    startTaskId?: string | null;
  },
): boolean {
  const db = getDb();
  if (patch.startTaskId !== undefined && patch.startTaskId !== null) {
    const task = db
      .prepare("SELECT 1 AS ok FROM tasks WHERE id = ? AND plan_id = ?")
      .get(patch.startTaskId, planId) as { ok: number } | undefined;
    if (!task) {
      throw new ApiError(
        400,
        "VALIDATION",
        "That task does not belong to this plan.",
      );
    }
  }
  const updates: string[] = [];
  const params: unknown[] = [];
  if (patch.title !== undefined) {
    updates.push("title = ?");
    params.push(patch.title);
  }
  if (patch.horizonDate !== undefined) {
    updates.push("horizon_date = ?");
    params.push(patch.horizonDate);
  }
  if (patch.availableMinutesPerWeek !== undefined) {
    updates.push("available_minutes_per_week = ?");
    params.push(patch.availableMinutesPerWeek);
  }
  if (patch.status !== undefined) {
    updates.push("status = ?");
    params.push(patch.status);
  }
  if (patch.startTaskId !== undefined) {
    updates.push("start_task_id = ?");
    params.push(patch.startTaskId);
  }
  updates.push("updated_at = ?");
  params.push(nowIso());
  params.push(planId, userId);

  const result = db
    .prepare(
      `UPDATE plans SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`,
    )
    .run(...params);
  if (result.changes > 0 && patch.status === "active") {
    recalculatePlanStatus(planId, db);
  }
  return result.changes > 0;
}

export function deletePlanForUser(planId: string, userId: string): boolean {
  const db = getDb();
  const transaction = db.transaction(() => {
    db.prepare(
      "DELETE FROM plan_drafts WHERE user_id = ? AND approved_plan_id = ?",
    ).run(userId, planId);
    return db
      .prepare("DELETE FROM plans WHERE id = ? AND user_id = ?")
      .run(planId, userId).changes;
  });
  return transaction() > 0;
}

export function clearRawDumpsForUser(userId: string): number {
  const result = getDb()
    .prepare(
      `UPDATE plans SET source_dump = NULL
       WHERE user_id = ? AND source_dump IS NOT NULL`,
    )
    .run(userId);
  return result.changes;
}

export function getAccountDataStats(userId: string): {
  planCount: number;
  retainedDumpCount: number;
} {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS plan_count,
              COALESCE(SUM(CASE WHEN source_dump IS NOT NULL THEN 1 ELSE 0 END), 0)
                AS retained_dump_count
       FROM plans WHERE user_id = ?`,
    )
    .get(userId) as { plan_count: number; retained_dump_count: number };
  return {
    planCount: row.plan_count,
    retainedDumpCount: row.retained_dump_count,
  };
}
