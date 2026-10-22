import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { DraftContent } from "@/lib/schemas";

const tempDir = mkdtempSync(join(tmpdir(), "clearstep-integration-"));
process.env.DATABASE_PATH = join(tempDir, "test.db");
process.env.APP_SECRET = "clearstep-integration-test-secret";

const { getDb, nowIso } = await import("@/lib/db");
const { createDraft, getDraft } = await import("@/lib/drafts");
const { createApprovedPlan } = await import("@/lib/plans");
const { acceptRevision, createReplanRevision, getRevision } = await import(
  "@/lib/revisions"
);

const content: DraftContent = {
  title: "Test plan",
  summary: "A small plan used to exercise approval and re-planning.",
  statedFacts: ["The test starts from a clean database."],
  assumptions: ["The test controls the clock."],
  tasks: [
    {
      id: "task-one",
      title: "First task",
      description: "Do the first thing.",
      effortMin: 10,
      effortMax: 20,
      dependsOn: [],
      rationale: null,
      isAssumption: false,
    },
    {
      id: "task-two",
      title: "Second task",
      description: "Do the second thing.",
      effortMin: 15,
      effortMax: 30,
      dependsOn: ["task-one"],
      rationale: null,
      isAssumption: false,
    },
    {
      id: "task-three",
      title: "Third task",
      description: "Do the third thing.",
      effortMin: 5,
      effortMax: 10,
      dependsOn: [],
      rationale: null,
      isAssumption: false,
    },
  ],
  clarifyingQuestion: null,
  startHereTaskId: "task-one",
};

function createUser(): string {
  const userId = randomUUID();
  getDb()
    .prepare(
      `INSERT INTO users (
        id, email, password_hash, preferences_json, created_at
      ) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      userId,
      `${userId}@example.com`,
      "not-a-real-hash",
      '{"aiPreference":"ask"}',
      nowIso(),
    );
  return userId;
}

function createApprovedFixture(): {
  userId: string;
  draftId: string;
  planId: string;
} {
  const userId = createUser();
  const draftId = createDraft({
    userId,
    requestId: randomUUID(),
    dump: "A test dump with enough detail to approve a plan.",
    outcome: "Finish the test fixture",
    horizonDate: null,
    availableMinutesPerWeek: 180,
    constraints: null,
    aiConsent: false,
    mode: "manual",
    fallbackReason: null,
    fallbackKind: null,
    modelName: null,
    content,
  });
  const draft = getDraft(userId, draftId);
  if (!draft) throw new Error("Test draft was not created.");
  const planId = createApprovedPlan(draft, content);
  return { userId, draftId, planId };
}

describe("plan write idempotency", () => {
  it("reuses the approved plan when the same stale draft is approved twice", () => {
    const userId = createUser();
    const draftId = createDraft({
      userId,
      requestId: randomUUID(),
      dump: "A test dump with enough detail to approve a plan.",
      outcome: "Finish the test fixture",
      horizonDate: null,
      availableMinutesPerWeek: 180,
      constraints: null,
      aiConsent: false,
      mode: "manual",
      fallbackReason: null,
      fallbackKind: null,
      modelName: null,
      content,
    });
    const staleDraft = getDraft(userId, draftId);
    if (!staleDraft) throw new Error("Test draft was not created.");

    const firstPlanId = createApprovedPlan(staleDraft, content);
    const secondPlanId = createApprovedPlan(staleDraft, content);

    expect(secondPlanId).toBe(firstPlanId);
    const row = getDb()
      .prepare("SELECT COUNT(*) AS count FROM plans WHERE user_id = ?")
      .get(userId) as { count: number };
    expect(row.count).toBe(1);
  });

  it("treats accepting the same revision twice as a successful retry", () => {
    const { userId, planId } = createApprovedFixture();
    const created = createReplanRevision({
      planId,
      userId,
      availableMinutesPerWeek: 240,
    });
    if (!created) throw new Error("Test re-plan was not created.");
    expect(created.revision.status).toBe("pending");

    const first = acceptRevision(planId, created.revision.id, userId);
    expect(first).toEqual({ planId });
    expect(getRevision(planId, created.revision.id, userId)?.status).toBe(
      "accepted",
    );

    const retry = acceptRevision(planId, created.revision.id, userId);
    expect(retry).toEqual({ planId });
    expect(getRevision(planId, created.revision.id, userId)?.status).toBe(
      "accepted",
    );

    const row = getDb()
      .prepare(
        `SELECT COUNT(*) AS count FROM plan_revisions
         WHERE plan_id = ? AND status = 'accepted'`,
      )
      .get(planId) as { count: number };
    expect(row.count).toBe(2);
  });
});

afterAll(() => {
  try {
    getDb().close();
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
