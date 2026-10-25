import { beforeEach, describe, expect, it } from "vitest";
import {
  clearGuestPlan,
  createGuestPlanFromDraft,
  GUEST_PLAN_STORAGE_KEY,
  guestPlanSchema,
  loadGuestPlan,
  saveGuestPlan,
} from "@/lib/guest-storage";
import { buildManualDraft } from "@/lib/planner/manual";

describe("guest-storage", () => {
  const mockStorage: Record<string, string> = {};

  beforeEach(() => {
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }

    // Set up mock localStorage
    Object.defineProperty(globalThis, "window", {
      value: {
        localStorage: {
          getItem: (key: string) => mockStorage[key] ?? null,
          setItem: (key: string, val: string) => {
            mockStorage[key] = val;
          },
          removeItem: (key: string) => {
            delete mockStorage[key];
          },
        },
      },
      writable: true,
      configurable: true,
    });
  });

  it("returns null when storage is empty or invalid", () => {
    expect(loadGuestPlan()).toBeNull();

    mockStorage[GUEST_PLAN_STORAGE_KEY] = "not-json";
    expect(loadGuestPlan()).toBeNull();

    mockStorage[GUEST_PLAN_STORAGE_KEY] = JSON.stringify({ version: 2, invalid: true });
    expect(loadGuestPlan()).toBeNull();
  });

  it("converts a manual draft into a valid GuestPlan and saves/loads it", () => {
    const draft = buildManualDraft({
      outcome: "Clean up flat",
      dump: "- Vacuum living room\n- Dust shelves\n- Take out trash",
      horizonDate: null,
      availableMinutesPerWeek: null,
      constraints: null,
    });

    const guestPlan = createGuestPlanFromDraft({
      dump: "Vacuum living room\nDust shelves\nTake out trash",
      outcome: "Clean up flat",
      content: draft,
      status: "active",
    });

    expect(guestPlanSchema.safeParse(guestPlan).success).toBe(true);
    expect(guestPlan.tasks).toHaveLength(3);
    expect(guestPlan.tasks[0]?.status).toBe("not_started");
    expect(guestPlan.tasks[0]?.note).toBe("");
    expect(guestPlan.status).toBe("active");

    saveGuestPlan(guestPlan);

    const loaded = loadGuestPlan();
    expect(loaded).not.toBeNull();
    expect(loaded?.title).toBe(guestPlan.title);
    expect(loaded?.tasks[0]?.title).toBe(guestPlan.tasks[0]?.title);

    // Test clear
    clearGuestPlan();
    expect(loadGuestPlan()).toBeNull();
  });

  it("updates task status and persists changes", () => {
    const draft = buildManualDraft({
      outcome: "Job Prep",
      dump: "- Polish resume\n- Practice mock questions\n- Review company website",
      horizonDate: "2026-11-01",
      availableMinutesPerWeek: 120,
      constraints: null,
    });

    const guestPlan = createGuestPlanFromDraft({
      dump: "Resume, questions, website",
      outcome: "Job Prep",
      content: draft,
    });

    // Mark task 0 as done
    guestPlan.tasks[0]!.status = "done";
    guestPlan.tasks[0]!.completedAt = new Date().toISOString();
    guestPlan.tasks[0]!.note = "Updated with 2026 metrics.";

    saveGuestPlan(guestPlan);

    const loaded = loadGuestPlan();
    expect(loaded?.tasks[0]?.status).toBe("done");
    expect(loaded?.tasks[0]?.note).toBe("Updated with 2026 metrics.");
    expect(loaded?.tasks[0]?.completedAt).toBeTruthy();
  });
});
