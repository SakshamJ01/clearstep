import "server-only";

import { z } from "zod";
import { ApiError } from "@/lib/api";
import { getDb, nowIso } from "@/lib/db";
import { getPlanDetail, type PlanDetail } from "@/lib/plans";
import { buildReplanProposal } from "@/lib/replan";
import { randomId } from "@/lib/secrets";
import {
  isValidDateString,
  type PlanStatus,
  type TaskStatus,
} from "@/lib/schemas";
import {
  AVAILABLE_MINUTES_MAX,
  AVAILABLE_MINUTES_MIN,
} from "@/lib/constants";

interface RevisionRow {
  id: string;
  plan_id: string;
  revision_number: number;
  status: "pending" | "accepted" | "cancelled";
  assumptions_json: string;
  changes_json: string;
  payload_json: string;
  model_version: string | null;
  created_at: string;
  accepted_at: string | null;
}

const replanPayloadSchema = z
  .object({
    taskOrder: z.array(z.string().min(1).max(64)).max(200),
    startTaskId: z.string().min(1).max(64).nullable(),
    horizonDate: z
      .string()
      .nullable()
      .refine((value) => value === null || isValidDateString(value)),
    availableMinutesPerWeek: z
      .number()
      .int()
      .min(AVAILABLE_MINUTES_MIN)
      .max(AVAILABLE_MINUTES_MAX)
      .nullable(),
    summary: z.string().min(1).max(600),
    estimatedOpenMinutesMin: z.number().int().nonnegative(),
    estimatedOpenMinutesMax: z.number().int().nonnegative(),
    completedPreserved: z.literal(true),
  })
  .strict();

export type ReplanPayload = z.infer<typeof replanPayloadSchema>;

export interface RevisionView {
  id: string;
  planId: string;
  number: number;
  status: RevisionRow["status"];
  assumptions: string[];
  changes: string[];
  payload: ReplanPayload;
  createdAt: string;
  acceptedAt: string | null;
}

function parseStringArray(raw: string, limit = 8): string[] {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return [];
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, limit);
  } catch {
    return [];
  }
}

function rowToView(row: RevisionRow): RevisionView {
  const payload = replanPayloadSchema.safeParse(
    JSON.parse(row.payload_json) as unknown,
  );
  if (!payload.success) {
    throw new Error("Stored revision payload failed validation.");
  }
  return {
    id: row.id,
    planId: row.plan_id,
    number: row.revision_number,
    status: row.status,
    assumptions: parseStringArray(row.assumptions_json),
    changes: parseStringArray(row.changes_json),
    payload: payload.data,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at,
  };
}

export function createReplanRevision(options: {
  planId: string;
  userId: string;
  horizonDate?: string | null;
  availableMinutesPerWeek?: number | null;
}): { plan: PlanDetail; revision: RevisionView } | null {
  const plan = getPlanDetail(options.planId, options.userId);
  if (!plan) return null;
  if (plan.status === "archived") {
    throw new ApiError(
      409,
      "PLAN_ARCHIVED",
      "Restore this plan before re-planning it.",
    );
  }

  const horizonDate =
    options.horizonDate !== undefined ? options.horizonDate : plan.horizonDate;
  const availableMinutesPerWeek =
    options.availableMinutesPerWeek !== undefined
      ? options.availableMinutesPerWeek
      : plan.availableMinutesPerWeek;

  const proposal = buildReplanProposal({
    tasks: plan.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      sortOrder: task.sortOrder,
      effortMin: task.effortMin,
      effortMax: task.effortMax,
      dependsOn: task.dependsOn.map((dependency) => dependency.id),
    })),
    currentStartTaskId: plan.startTaskId,
    currentHorizonDate: plan.horizonDate,
    currentAvailableMinutesPerWeek: plan.availableMinutesPerWeek,
    horizonDate,
    availableMinutesPerWeek,
  });

  const assumptions = [...plan.assumptions];
  const replanAssumption =
    "This plan was re-sequenced after a re-plan. Completed tasks and notes were preserved.";
  if (!assumptions.includes(replanAssumption) && assumptions.length < 8) {
    assumptions.push(replanAssumption);
  }

  const db = getDb();
  const timestamp = nowIso();
  const revisionId = randomId();

  const transaction = db.transaction(() => {
    db.prepare(
      `UPDATE plan_revisions SET status = 'cancelled'
       WHERE plan_id = ? AND status = 'pending'`,
    ).run(plan.id);
    const maxRow = db
      .prepare(
        "SELECT COALESCE(MAX(revision_number), 0) AS max FROM plan_revisions WHERE plan_id = ?",
      )
      .get(plan.id) as { max: number };

    db.prepare(
      `INSERT INTO plan_revisions (
        id, plan_id, revision_number, status, assumptions_json,
        changes_json, payload_json, model_version, created_at, accepted_at
      ) VALUES (?, ?, ?, 'pending', ?, ?, ?, NULL, ?, NULL)`,
    ).run(
      revisionId,
      plan.id,
      maxRow.max + 1,
      JSON.stringify(assumptions),
      JSON.stringify(proposal.changes),
      JSON.stringify({
        taskOrder: proposal.taskOrder,
        startTaskId: proposal.startTaskId,
        horizonDate: proposal.horizonDate,
        availableMinutesPerWeek: proposal.availableMinutesPerWeek,
        summary: proposal.summary,
        estimatedOpenMinutesMin: proposal.estimatedOpenMinutesMin,
        estimatedOpenMinutesMax: proposal.estimatedOpenMinutesMax,
        completedPreserved: true,
      }),
      timestamp,
    );
  });
  transaction.immediate();

  const revision = getRevision(plan.id, revisionId, options.userId);
  if (!revision) {
    throw new Error("Revision was created but could not be read.");
  }
  return { plan, revision };
}

export function getRevision(
  planId: string,
  revisionId: string,
  userId: string,
): RevisionView | null {
  const row = getDb()
    .prepare(
      `SELECT r.* FROM plan_revisions r
       JOIN plans p ON p.id = r.plan_id
       WHERE r.id = ? AND r.plan_id = ? AND p.user_id = ?`,
    )
    .get(revisionId, planId, userId) as RevisionRow | undefined;
  return row ? rowToView(row) : null;
}

export function getPendingRevision(
  planId: string,
  userId: string,
): RevisionView | null {
  const row = getDb()
    .prepare(
      `SELECT r.* FROM plan_revisions r
       JOIN plans p ON p.id = r.plan_id
       WHERE r.plan_id = ? AND p.user_id = ? AND r.status = 'pending'
       ORDER BY r.revision_number DESC LIMIT 1`,
    )
    .get(planId, userId) as RevisionRow | undefined;
  return row ? rowToView(row) : null;
}

export function acceptRevision(
  planId: string,
  revisionId: string,
  userId: string,
): { planId: string } | null {
  const db = getDb();

  const transaction = db.transaction(() => {
    const revisionRow = db
      .prepare(
        `SELECT r.*, p.status AS plan_status
         FROM plan_revisions r
         JOIN plans p ON p.id = r.plan_id
         WHERE r.id = ? AND r.plan_id = ? AND p.user_id = ?`,
      )
      .get(revisionId, planId, userId) as
      | (RevisionRow & { plan_status: PlanStatus })
      | undefined;
    if (!revisionRow) return null;
    if (revisionRow.status === "accepted") {
      return { planId };
    }
    if (revisionRow.plan_status === "archived") {
      throw new ApiError(
        409,
        "PLAN_ARCHIVED",
        "Restore this plan before applying a re-plan.",
      );
    }
    if (revisionRow.status !== "pending") {
      throw new ApiError(
        409,
        "REVISION_NOT_PENDING",
        "This revision is no longer waiting for a decision.",
      );
    }

    const parsedPayload = replanPayloadSchema.safeParse(
      JSON.parse(revisionRow.payload_json) as unknown,
    );
    if (!parsedPayload.success) {
      throw new ApiError(
        409,
        "REVISION_INVALID",
        "This re-plan can no longer be applied. Generate a new preview.",
      );
    }
    const payload = parsedPayload.data;

    const taskRows = db
      .prepare("SELECT id, status FROM tasks WHERE plan_id = ?")
      .all(planId) as Array<{ id: string; status: TaskStatus }>;
    const taskById = new Map(taskRows.map((task) => [task.id, task]));

    const openOrder: string[] = [];
    const seen = new Set<string>();
    for (const taskId of payload.taskOrder) {
      const task = taskById.get(taskId);
      if (!task || task.status === "done" || seen.has(taskId)) continue;
      seen.add(taskId);
      openOrder.push(taskId);
    }
    for (const task of taskRows) {
      if (task.status !== "done" && !seen.has(task.id)) {
        seen.add(task.id);
        openOrder.push(task.id);
      }
    }

    let startTaskId =
      payload.startTaskId && seen.has(payload.startTaskId)
        ? payload.startTaskId
        : null;
    if (!startTaskId) startTaskId = openOrder[0] ?? null;

    const updateOrder = db.prepare(
      "UPDATE tasks SET sort_order = ?, updated_at = ? WHERE id = ?",
    );
    openOrder.forEach((taskId, index) => {
      updateOrder.run((index + 1) * 10, nowIso(), taskId);
    });

    db.prepare(
      `UPDATE plans
       SET horizon_date = ?, available_minutes_per_week = ?,
           start_task_id = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
    ).run(
      payload.horizonDate,
      payload.availableMinutesPerWeek,
      startTaskId,
      nowIso(),
      planId,
      userId,
    );

    db.prepare(
      `UPDATE plan_revisions SET status = 'cancelled'
       WHERE plan_id = ? AND status = 'pending' AND id <> ?`,
    ).run(planId, revisionId);

    const accepted = db
      .prepare(
        `UPDATE plan_revisions
         SET status = 'accepted', accepted_at = ?
         WHERE id = ? AND plan_id = ? AND status = 'pending'`,
      )
      .run(nowIso(), revisionId, planId);
    if (accepted.changes !== 1) {
      throw new ApiError(
        409,
        "REVISION_CONFLICT",
        "This re-plan changed elsewhere. Reload the plan to see its current state.",
      );
    }

    return { planId };
  });

  return transaction.immediate();
}
