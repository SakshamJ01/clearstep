import { z } from "zod";
import {
  AVAILABLE_MINUTES_MAX,
  AVAILABLE_MINUTES_MIN,
  CONSTRAINTS_MAX_CHARS,
  DUMP_MAX_CHARS,
  NOTE_MAX_CHARS,
  OUTCOME_MAX_CHARS,
  TASK_MAX,
  TASK_MIN,
} from "@/lib/constants";

export const taskStatusSchema = z.enum([
  "not_started",
  "in_progress",
  "done",
  "blocked",
]);

export const planStatusSchema = z.enum([
  "draft",
  "active",
  "completed",
  "archived",
]);

export const generationModeSchema = z.enum(["ai", "manual", "manual_fallback"]);

export const aiPreferenceSchema = z.enum(["ask", "manual_only"]);

export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type PlanStatus = z.infer<typeof planStatusSchema>;
export type GenerationMode = z.infer<typeof generationModeSchema>;
export type AiPreference = z.infer<typeof aiPreferenceSchema>;

const idPattern = /^[A-Za-z0-9_-]{1,40}$/;

export function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export const draftTaskSchema = z
  .object({
    id: z.string().regex(idPattern, "Task ids must be short and URL-safe."),
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().min(1).max(600),
    effortMin: z.number().int().min(5).max(600).nullable(),
    effortMax: z.number().int().min(5).max(600).nullable(),
    dependsOn: z.array(z.string().regex(idPattern)).max(8),
    rationale: z.string().trim().max(300).nullable(),
    isAssumption: z.boolean(),
  })
  .strict()
  .superRefine((task, ctx) => {
    if (
      task.effortMin !== null &&
      task.effortMax !== null &&
      task.effortMin > task.effortMax
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["effortMax"],
        message: "Maximum effort must be at least the minimum.",
      });
    }
  });

export const draftContentSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    summary: z.string().trim().min(1).max(600),
    statedFacts: z.array(z.string().trim().min(1).max(240)).max(8),
    assumptions: z.array(z.string().trim().min(1).max(240)).max(8),
    tasks: z.array(draftTaskSchema).min(TASK_MIN).max(TASK_MAX),
    clarifyingQuestion: z.string().trim().max(300).nullable(),
    startHereTaskId: z.string().regex(idPattern).nullable(),
  })
  .strict();

export type DraftTask = z.infer<typeof draftTaskSchema>;
export type DraftContent = z.infer<typeof draftContentSchema>;

export const planningInputSchema = z
  .object({
    requestId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
    dump: z
      .string()
      .trim()
      .min(20, "Add a little more context so there is something to plan.")
      .max(DUMP_MAX_CHARS, "Keep the dump under 8,000 characters."),
    outcome: z
      .string()
      .trim()
      .min(3, "Name the outcome you want.")
      .max(OUTCOME_MAX_CHARS),
    horizonDate: z
      .string()
      .trim()
      .refine(
        (value) => value === "" || isValidDateString(value),
        "Enter a valid deadline.",
      )
      .nullable(),
    availableMinutesPerWeek: z
      .number()
      .int()
      .min(AVAILABLE_MINUTES_MIN)
      .max(AVAILABLE_MINUTES_MAX)
      .nullable(),
    constraints: z.string().trim().max(CONSTRAINTS_MAX_CHARS).nullable(),
    aiConsent: z.boolean(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.horizonDate && value.horizonDate < todayIso()) {
      ctx.addIssue({
        code: "custom",
        path: ["horizonDate"],
        message: "The deadline cannot be in the past.",
      });
    }
  });

export type PlanningInput = z.infer<typeof planningInputSchema>;

export const approvalSchema = z
  .object({
    draftId: z.string().trim().min(8).max(64),
    content: draftContentSchema,
  })
  .strict();

export const draftUpdateSchema = z
  .object({
    content: draftContentSchema,
  })
  .strict();

export const taskCreateSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().min(1).max(600),
    effortMin: z.number().int().min(5).max(600).nullable(),
    effortMax: z.number().int().min(5).max(600).nullable(),
    note: z.string().trim().max(NOTE_MAX_CHARS).nullable().optional(),
    dependsOn: z.array(z.string().regex(idPattern)).max(8).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.effortMin !== null &&
      value.effortMax !== null &&
      value.effortMin > value.effortMax
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["effortMax"],
        message: "Maximum effort must be at least the minimum.",
      });
    }
  });

export type TaskCreateInput = z.infer<typeof taskCreateSchema>;

export const taskPatchSchema = z
  .object({
    title: z.string().trim().min(3).max(120).optional(),
    description: z.string().trim().min(1).max(600).optional(),
    effortMin: z.number().int().min(5).max(600).nullable().optional(),
    effortMax: z.number().int().min(5).max(600).nullable().optional(),
    status: taskStatusSchema.optional(),
    sortOrder: z.number().int().min(0).max(100000).optional(),
    note: z.string().trim().max(NOTE_MAX_CHARS).nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "There is nothing to update.",
  })
  .superRefine((value, ctx) => {
    if (
      value.effortMin !== undefined &&
      value.effortMax !== undefined &&
      value.effortMin !== null &&
      value.effortMax !== null &&
      value.effortMin > value.effortMax
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["effortMax"],
        message: "Maximum effort must be at least the minimum.",
      });
    }
  });

export const planPatchSchema = z
  .object({
    title: z.string().trim().min(3).max(120).optional(),
    horizonDate: z
      .string()
      .trim()
      .refine(isValidDateString, "Enter a valid deadline.")
      .nullable()
      .optional(),
    availableMinutesPerWeek: z
      .number()
      .int()
      .min(AVAILABLE_MINUTES_MIN)
      .max(AVAILABLE_MINUTES_MAX)
      .nullable()
      .optional(),
    status: z.enum(["active", "archived"]).optional(),
    startTaskId: z
      .string()
      .regex(idPattern, "Choose a valid start task.")
      .nullable()
      .optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "There is nothing to update.",
  });

export const replanInputSchema = z
  .object({
    horizonDate: z
      .string()
      .trim()
      .refine(isValidDateString, "Enter a valid deadline.")
      .nullable()
      .optional(),
    availableMinutesPerWeek: z
      .number()
      .int()
      .min(AVAILABLE_MINUTES_MIN)
      .max(AVAILABLE_MINUTES_MAX)
      .nullable()
      .optional(),
  })
  .strict();

export const signupSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z
      .string()
      .min(10, "Use at least 10 characters.")
      .max(200, "Use a shorter password."),
  })
  .strict();

export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(1).max(200),
  })
  .strict();

export const preferencesSchema = z
  .object({
    aiPreference: aiPreferenceSchema,
  })
  .strict();

export const accountDeleteSchema = z
  .object({
    confirmation: z.literal("DELETE"),
  })
  .strict();
