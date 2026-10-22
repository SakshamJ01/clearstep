import { describe, expect, it } from "vitest";
import { taskOrderSchema } from "@/lib/schemas";

describe("taskOrderSchema", () => {
  it("accepts a unique non-empty task order", () => {
    expect(taskOrderSchema.safeParse({ taskIds: ["a", "b", "c"] }).success).toBe(
      true,
    );
  });

  it("rejects duplicate task ids", () => {
    expect(taskOrderSchema.safeParse({ taskIds: ["a", "a"] }).success).toBe(false);
  });

  it("rejects an empty order", () => {
    expect(taskOrderSchema.safeParse({ taskIds: [] }).success).toBe(false);
  });

  it("rejects unsafe ids and extra fields", () => {
    expect(
      taskOrderSchema.safeParse({ taskIds: ["not a task"] }).success,
    ).toBe(false);
    expect(
      taskOrderSchema.safeParse({ taskIds: ["a"], extra: true }).success,
    ).toBe(false);
  });
});
