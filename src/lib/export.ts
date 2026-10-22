import type { PlanDetail } from "@/lib/plans";
import {
  formatDateHuman,
  formatEffort,
  generationModeLabel,
  planStatusLabel,
  taskStatusLabel,
} from "@/lib/format";

export type ExportFormat = "md" | "txt";

function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "clearstep-plan";
}

export function buildPlanExport(
  plan: PlanDetail,
  format: ExportFormat,
): { body: string; filename: string; contentType: string } {
  const openTasks = plan.tasks
    .filter((task) => task.status !== "done")
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const doneTasks = plan.tasks.filter((task) => task.status === "done");
  const nextTask =
    plan.nextTaskId !== null
      ? plan.tasks.find((task) => task.id === plan.nextTaskId) ?? null
      : null;

  const lines: string[] = [];
  const heading = (text: string) =>
    format === "md" ? lines.push(`## ${text}`, "") : lines.push(text.toUpperCase(), "");
  const taskLine = (task: PlanDetail["tasks"][number], index: number) => {
    const marker =
      task.status === "done"
        ? "[x]"
        : task.status === "blocked"
          ? "[!]"
          : task.status === "in_progress"
            ? "[~]"
            : "[ ]";
    lines.push(
      `${format === "md" ? `### ${index}. ` : `${index}. `}${task.title}`,
      `${marker} ${taskStatusLabel(task.status)} · ${formatEffort(task.effortMin, task.effortMax)}`,
      "",
      task.description,
    );
    if (task.dependsOn.length > 0) {
      lines.push(
        "",
        `Depends on: ${task.dependsOn.map((dependency) => dependency.title).join("; ")}`,
      );
    }
    if (task.rationale) {
      lines.push("", `Why: ${task.rationale}`);
    }
    if (task.note) {
      lines.push("", `Note: ${task.note}`);
    }
    lines.push("");
  };

  if (format === "md") {
    lines.push(`# ${plan.title}`, "", `**Outcome:** ${plan.desiredOutcome}`, "");
  } else {
    lines.push(plan.title, "", `Outcome: ${plan.desiredOutcome}`, "");
  }

  lines.push(
    `Status: ${planStatusLabel(plan.status)}`,
    `Deadline: ${formatDateHuman(plan.horizonDate)}`,
    `Weekly time: ${
      plan.availableMinutesPerWeek
        ? `${plan.availableMinutesPerWeek} minutes`
        : "not set"
    }`,
    `Progress: ${plan.doneTasks} of ${plan.totalTasks} tasks done`,
    `Draft type: ${generationModeLabel(plan.generationMode)}`,
    `Exported: ${new Date().toISOString().slice(0, 10)}`,
  );
  if (plan.constraints) {
    lines.push(`Constraints: ${plan.constraints}`);
  }
  lines.push("");

  heading("Start here");
  lines.push(
    nextTask ? `${nextTask.title}` : "No open task is currently actionable.",
    "",
  );

  heading("Open tasks");
  if (openTasks.length === 0) {
    lines.push("None. Everything is done.", "");
  } else {
    openTasks.forEach((task, index) => taskLine(task, index + 1));
  }

  if (doneTasks.length > 0) {
    heading("Completed");
    doneTasks.forEach((task, index) => taskLine(task, index + 1));
  }

  heading("Assumptions to check");
  if (plan.assumptions.length === 0) {
    lines.push("None recorded.", "");
  } else {
    for (const assumption of plan.assumptions) {
      lines.push(`- ${assumption}`);
    }
    lines.push("");
  }

  lines.push(
    "---",
    "Exported from Clearstep. Plans are drafts, not professional advice.",
  );

  return {
    body: `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`,
    filename: `${slugify(plan.title)}-clearstep.${format}`,
    contentType:
      format === "md"
        ? "text/markdown; charset=utf-8"
        : "text/plain; charset=utf-8",
  };
}
