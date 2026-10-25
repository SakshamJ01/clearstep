import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { GuestPlan } from "@/lib/guest-storage";

const tempDir = mkdtempSync(join(tmpdir(), "clearstep-claim-test-"));
process.env.DATABASE_PATH = join(tempDir, "test.db");
process.env.APP_SECRET = "clearstep-claim-test-secret";

const { getDb, nowIso } = await import("@/lib/db");
const { createClaimedPlan, getPlanDetail } = await import("@/lib/plans");

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

afterAll(() => {
  try {
    rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors on Windows
  }
});

describe("createClaimedPlan", () => {
  it("claims a guest plan into SQLite preserving tasks, notes, and completion statuses", () => {
    const userId = createUser();

    const guestPlan: GuestPlan = {
      version: 1,
      id: "guest-local-123",
      title: "Clean Apartment",
      desiredOutcome: "Have a clean space before the weekend",
      sourceDump: "- Vacuum bedroom\n- Wash dishes\n- Take out recycling",
      horizonDate: "2026-11-01",
      availableMinutesPerWeek: 120,
      constraintsText: "No noisy vacuuming after 9pm",
      startTaskId: "t1",
      tasks: [
        {
          id: "t1",
          title: "Wash dishes",
          description: "Clear the kitchen sink and run the dishwasher.",
          effortMin: 15,
          effortMax: 25,
          status: "done",
          sortOrder: 10,
          rationale: "Quick win to clear the kitchen.",
          note: "Used lemon detergent, clean now.",
          completedAt: "2026-10-25T12:00:00.000Z",
          dependsOn: [],
        },
        {
          id: "t2",
          title: "Vacuum bedroom",
          description: "Vacuum under the bed and dresser.",
          effortMin: 20,
          effortMax: 30,
          status: "not_started",
          sortOrder: 20,
          rationale: null,
          note: "",
          completedAt: null,
          dependsOn: ["t1"],
        },
        {
          id: "t3",
          title: "Take out recycling",
          description: "Sort cardboard and plastic into bins.",
          effortMin: 5,
          effortMax: 10,
          status: "not_started",
          sortOrder: 30,
          rationale: null,
          note: "Don't forget glass bottles.",
          completedAt: null,
          dependsOn: [],
        },
      ],
      facts: ["Goal is clean apartment."],
      assumptions: ["Manual draft."],
      createdAt: "2026-10-25T11:00:00.000Z",
      updatedAt: "2026-10-25T12:00:00.000Z",
      status: "active",
    };

    const planId = createClaimedPlan(userId, guestPlan);
    expect(planId).toBeTruthy();

    const plan = getPlanDetail(planId, userId);
    expect(plan).not.toBeNull();
    expect(plan?.title).toBe("Clean Apartment");
    expect(plan?.desiredOutcome).toBe("Have a clean space before the weekend");
    expect(plan?.horizonDate).toBe("2026-11-01");
    expect(plan?.tasks).toHaveLength(3);

    // Verify task 1 preserved completed status and encrypted note
    const task1 = plan?.tasks.find((t) => t.title === "Wash dishes");
    expect(task1).toBeDefined();
    expect(task1?.status).toBe("done");
    expect(task1?.note).toBe("Used lemon detergent, clean now.");
    expect(task1?.completedAt).toBe("2026-10-25T12:00:00.000Z");

    // Verify task 2 preserved dependency on task 1
    const task2 = plan?.tasks.find((t) => t.title === "Vacuum bedroom");
    expect(task2).toBeDefined();
    expect(task2?.status).toBe("not_started");
    expect(task2?.dependsOn).toHaveLength(1);
    expect(task2?.dependsOn[0]?.title).toBe("Wash dishes");

    // Verify task 3 preserved note
    const task3 = plan?.tasks.find((t) => t.title === "Take out recycling");
    expect(task3?.note).toBe("Don't forget glass bottles.");
  });
});
