import "server-only";

import {
  DRAFT_RETENTION_DAYS,
  RAW_DUMP_RETENTION_DAYS,
} from "@/lib/constants";
import { getDb, isoDaysAgo, nowIso } from "@/lib/db";
import {
  draftContentSchema,
  type DraftContent,
  type GenerationMode,
} from "@/lib/schemas";
import {
  decryptText,
  encryptText,
  randomId,
} from "@/lib/secrets";

interface DraftRow {
  id: string;
  user_id: string;
  request_id: string;
  source_dump: string;
  outcome: string;
  horizon_date: string | null;
  available_minutes_per_week: number | null;
  constraints_text: string | null;
  ai_consent: number;
  generation_mode: GenerationMode;
  fallback_reason: string | null;
  fallback_kind: string | null;
  model_name: string | null;
  content_json: string;
  approved_plan_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DraftRecord {
  id: string;
  userId: string;
  requestId: string;
  dump: string;
  outcome: string;
  horizonDate: string | null;
  availableMinutesPerWeek: number | null;
  constraints: string | null;
  aiConsent: boolean;
  mode: GenerationMode;
  fallbackReason: string | null;
  fallbackKind: string | null;
  modelName: string | null;
  content: DraftContent;
  approvedPlanId: string | null;
  createdAt: string;
  updatedAt: string;
}

function parseContent(raw: string): DraftContent {
  const parsed = draftContentSchema.safeParse(JSON.parse(raw) as unknown);
  if (!parsed.success) {
    throw new Error("Stored draft content failed validation.");
  }
  return parsed.data;
}

function rowToRecord(row: DraftRow): DraftRecord {
  return {
    id: row.id,
    userId: row.user_id,
    requestId: row.request_id,
    dump: decryptText(row.source_dump),
    outcome: row.outcome,
    horizonDate: row.horizon_date,
    availableMinutesPerWeek: row.available_minutes_per_week,
    constraints: decryptText(row.constraints_text),
    aiConsent: row.ai_consent === 1,
    mode: row.generation_mode,
    fallbackReason: row.fallback_reason,
    fallbackKind: row.fallback_kind,
    modelName: row.model_name,
    content: parseContent(row.content_json),
    approvedPlanId: row.approved_plan_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function findDraftByRequestId(
  userId: string,
  requestId: string,
): DraftRecord | null {
  const row = getDb()
    .prepare("SELECT * FROM plan_drafts WHERE user_id = ? AND request_id = ?")
    .get(userId, requestId) as DraftRow | undefined;
  return row ? rowToRecord(row) : null;
}

export function getDraft(userId: string, draftId: string): DraftRecord | null {
  const row = getDb()
    .prepare("SELECT * FROM plan_drafts WHERE id = ? AND user_id = ?")
    .get(draftId, userId) as DraftRow | undefined;
  return row ? rowToRecord(row) : null;
}

export function createDraft(options: {
  userId: string;
  requestId: string;
  dump: string;
  outcome: string;
  horizonDate: string | null;
  availableMinutesPerWeek: number | null;
  constraints: string | null;
  aiConsent: boolean;
  mode: GenerationMode;
  fallbackReason: string | null;
  fallbackKind: string | null;
  modelName: string | null;
  content: DraftContent;
}): string {
  const id = randomId();
  const timestamp = nowIso();
  getDb()
    .prepare(
      `INSERT INTO plan_drafts (
        id, user_id, request_id, source_dump, outcome, horizon_date,
        available_minutes_per_week, constraints_text, ai_consent,
        generation_mode, fallback_reason, fallback_kind, model_name,
        content_json, approved_plan_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    )
    .run(
      id,
      options.userId,
      options.requestId,
      encryptText(options.dump),
      options.outcome,
      options.horizonDate,
      options.availableMinutesPerWeek,
      encryptText(options.constraints),
      options.aiConsent ? 1 : 0,
      options.mode,
      options.fallbackReason,
      options.fallbackKind,
      options.modelName,
      JSON.stringify(options.content),
      timestamp,
      timestamp,
    );
  return id;
}

export function updateDraftContent(
  userId: string,
  draftId: string,
  content: DraftContent,
): DraftRecord | null {
  const result = getDb()
    .prepare(
      `UPDATE plan_drafts
       SET content_json = ?, updated_at = ?
       WHERE id = ? AND user_id = ? AND approved_plan_id IS NULL`,
    )
    .run(JSON.stringify(content), nowIso(), draftId, userId);
  if (result.changes === 0) return null;
  return getDraft(userId, draftId);
}

export function updateDraftGeneration(options: {
  userId: string;
  draftId: string;
  mode: GenerationMode;
  fallbackReason: string | null;
  fallbackKind: string | null;
  modelName: string | null;
  content: DraftContent;
}): DraftRecord | null {
  const result = getDb()
    .prepare(
      `UPDATE plan_drafts
       SET content_json = ?, generation_mode = ?, fallback_reason = ?,
           fallback_kind = ?, model_name = ?, updated_at = ?
       WHERE id = ? AND user_id = ? AND approved_plan_id IS NULL`,
    )
    .run(
      JSON.stringify(options.content),
      options.mode,
      options.fallbackReason,
      options.fallbackKind,
      options.modelName,
      nowIso(),
      options.draftId,
      options.userId,
    );
  if (result.changes === 0) return null;
  return getDraft(options.userId, options.draftId);
}

export function markDraftApproved(
  userId: string,
  draftId: string,
  planId: string,
): void {
  getDb()
    .prepare(
      `UPDATE plan_drafts
       SET approved_plan_id = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
    )
    .run(planId, nowIso(), draftId, userId);
}

export function deleteDraft(userId: string, draftId: string): boolean {
  const result = getDb()
    .prepare(
      `DELETE FROM plan_drafts
       WHERE id = ? AND user_id = ? AND approved_plan_id IS NULL`,
    )
    .run(draftId, userId);
  return result.changes > 0;
}

export function clearExpiredRawDumps(): number {
  const result = getDb()
    .prepare(
      `UPDATE plans SET source_dump = NULL
       WHERE source_dump IS NOT NULL AND created_at < ?`,
    )
    .run(isoDaysAgo(RAW_DUMP_RETENTION_DAYS));
  return result.changes;
}

let lastMaintenance = 0;

export function runMaintenance(): void {
  if (Date.now() - lastMaintenance < 60 * 60 * 1000) return;
  lastMaintenance = Date.now();
  getDb()
    .prepare(
      `DELETE FROM plan_drafts
       WHERE approved_plan_id IS NULL AND created_at < ?`,
    )
    .run(isoDaysAgo(DRAFT_RETENTION_DAYS));
  clearExpiredRawDumps();
  getDb()
    .prepare("DELETE FROM sessions WHERE expires_at <= ?")
    .run(nowIso());
}
