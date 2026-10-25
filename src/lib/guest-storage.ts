import { z } from "zod";
import type { DraftContent } from "@/lib/schemas";
import { taskStatusSchema } from "@/lib/schemas";

export const GUEST_PLAN_STORAGE_KEY = "clearstep:guest:v1:plan";

export const guestTaskSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().trim().min(1).max(140),
  description: z.string().trim().max(1000).default(""),
  effortMin: z.number().int().min(1).max(1000).nullable().default(null),
  effortMax: z.number().int().min(1).max(1000).nullable().default(null),
  status: taskStatusSchema.default("not_started"),
  sortOrder: z.number().int().default(0),
  rationale: z.string().trim().max(500).nullable().default(null),
  note: z.string().trim().max(2000).default(""),
  completedAt: z.string().nullable().default(null),
  dependsOn: z.array(z.string().min(1).max(64)).default([]),
});

export const guestPlanSchema = z.object({
  version: z.literal(1),
  id: z.string().min(1).max(64),
  title: z.string().trim().min(1).max(200),
  desiredOutcome: z.string().trim().max(500).default(""),
  sourceDump: z.string().trim().max(20000).default(""),
  horizonDate: z.string().nullable().default(null),
  availableMinutesPerWeek: z.number().int().nullable().default(null),
  constraintsText: z.string().nullable().default(null),
  startTaskId: z.string().nullable().default(null),
  tasks: z.array(guestTaskSchema),
  facts: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
  status: z.enum(["draft", "active"]).default("draft"),
});

export type GuestTask = z.infer<typeof guestTaskSchema>;
export type GuestPlan = z.infer<typeof guestPlanSchema>;

export function loadGuestPlan(): GuestPlan | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(GUEST_PLAN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const result = guestPlanSchema.safeParse(parsed);
    if (!result.success) {
      if (process.env.NODE_ENV !== "test") {
        console.warn("Invalid guest plan in localStorage, discarding.", result.error);
      }
      return null;
    }
    return result.data;
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("Failed to load guest plan from localStorage:", err);
    }
    return null;
  }
}

let cachedPlan: GuestPlan | null | undefined = undefined;
let listeners: Array<() => void> = [];

function notifyListeners() {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // ignore
    }
  }
}

export function subscribeGuestPlan(callback: () => void): () => void {
  listeners.push(callback);
  const handleStorage = (e: StorageEvent) => {
    if (e.key === GUEST_PLAN_STORAGE_KEY) {
      cachedPlan = undefined;
      callback();
    }
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorage);
  }
  return () => {
    listeners = listeners.filter((l) => l !== callback);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorage);
    }
  };
}

export function getGuestPlanSnapshot(): GuestPlan | null {
  if (typeof window === "undefined") return null;
  if (cachedPlan === undefined) {
    cachedPlan = loadGuestPlan();
  }
  return cachedPlan;
}

export function saveGuestPlan(plan: GuestPlan): void {
  if (typeof window === "undefined") return;
  try {
    const toSave: GuestPlan = {
      ...plan,
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(GUEST_PLAN_STORAGE_KEY, JSON.stringify(toSave));
    cachedPlan = toSave;
    notifyListeners();
  } catch (err) {
    console.warn("Failed to save guest plan to localStorage:", err);
  }
}

export function clearGuestPlan(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(GUEST_PLAN_STORAGE_KEY);
    cachedPlan = null;
    notifyListeners();
  } catch (err) {
    console.warn("Failed to clear guest plan from localStorage:", err);
  }
}

export function createGuestPlanFromDraft(input: {
  dump: string;
  outcome: string;
  horizonDate?: string | null;
  availableMinutesPerWeek?: number | null;
  constraints?: string | null;
  content: DraftContent;
  status?: "draft" | "active";
}): GuestPlan {
  const timestamp = new Date().toISOString();
  const tasks: GuestTask[] = input.content.tasks.map((task, index) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    effortMin: task.effortMin,
    effortMax: task.effortMax,
    status: "not_started",
    sortOrder: index,
    rationale: task.rationale,
    note: "",
    completedAt: null,
    dependsOn: task.dependsOn || [],
  }));

  return {
    version: 1,
    id: "guest-plan-local",
    title: input.content.title || input.outcome || "My Plan",
    desiredOutcome: input.outcome,
    sourceDump: input.dump,
    horizonDate: input.horizonDate ?? null,
    availableMinutesPerWeek: input.availableMinutesPerWeek ?? null,
    constraintsText: input.constraints ?? null,
    startTaskId: input.content.startHereTaskId ?? tasks[0]?.id ?? null,
    tasks,
    facts: input.content.statedFacts || [],
    assumptions: input.content.assumptions || [],
    createdAt: timestamp,
    updatedAt: timestamp,
    status: input.status ?? "draft",
  };
}
