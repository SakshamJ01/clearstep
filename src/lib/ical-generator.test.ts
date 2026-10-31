import { describe, expect, it } from "vitest";
import {
  escapeICalText,
  foldICalLine,
  formatICalDate,
  generatePlanICalendar,
  type ICalPlan,
} from "./ical-generator";

describe("ical-generator module", () => {
  it("formats dates in valid UTC ISO 8601 basic format", () => {
    const date = new Date(Date.UTC(2026, 10, 5, 14, 30, 0));
    expect(formatICalDate(date)).toBe("20261105T143000Z");
  });

  it("escapes special characters according to RFC 5545", () => {
    const raw = "Note: line 1\nline 2; with, commas & \\backslashes";
    const escaped = escapeICalText(raw);
    expect(escaped).toBe(
      "Note: line 1\\nline 2\\; with\\, commas & \\\\backslashes"
    );
  });

  it("folds long lines exceeding 75 characters with CRLF and space", () => {
    const shortLine = "SUMMARY:Short line";
    expect(foldICalLine(shortLine)).toBe(shortLine);

    const longLine =
      "DESCRIPTION:This is an extremely long description designed to exceed seventy-five octets and trigger RFC 5545 compliant line folding behavior";
    const folded = foldICalLine(longLine);
    expect(folded).toContain("\r\n ");
    expect(folded.length).toBeGreaterThan(longLine.length);
  });

  it("generates a valid .ics calendar with scheduled VEVENT blocks", () => {
    const plan: ICalPlan = {
      id: "plan-test-1",
      title: "Launch Project Gamma",
      desiredOutcome: "Deploy to production by Friday",
      tasks: [
        {
          id: "task-1",
          title: "Clear out old dependencies",
          description: "Run npm outdated and audit packages",
          status: "todo",
          effortMin: 20,
          effortMax: 30,
          rationale: "Prevents breaking version conflicts",
          note: "Check peer dependency warnings",
          sortOrder: 1,
        },
        {
          id: "task-2",
          title: "Setup CI GitHub workflow",
          description: "Add automated tests and linting",
          status: "todo",
          effortMin: 45,
          effortMax: 60,
          sortOrder: 2,
        },
        {
          id: "task-3",
          title: "Already completed step",
          description: "Already done",
          status: "done",
          sortOrder: 3,
        },
      ],
    };

    const ics = generatePlanICalendar(plan);

    // Verify VCALENDAR headers
    expect(ics).toContain("BEGIN:VCALENDAR\r\n");
    expect(ics).toContain("VERSION:2.0\r\n");
    expect(ics).toContain("PRODID:-//ClearStep//Executive Function Planner//EN\r\n");
    expect(ics).toContain("X-WR-CALNAME:Launch Project Gamma - Clearstep\r\n");

    // Verify VEVENT blocks for open tasks
    expect(ics).toContain("SUMMARY:1. Clear out old dependencies");
    expect(ics).toContain("SUMMARY:2. Setup CI GitHub workflow");

    // Completed task excluded by default
    expect(ics).not.toContain("Already completed step");

    // Ending tag
    expect(ics).toContain("END:VCALENDAR\r\n");
  });

  it("supports including completed tasks when flag is enabled", () => {
    const plan: ICalPlan = {
      id: "plan-test-2",
      title: "Audit Review",
      tasks: [
        {
          id: "task-done",
          title: "Completed Task",
          description: "Done",
          status: "done",
        },
      ],
    };

    const ics = generatePlanICalendar(plan, { includeCompleted: true });
    expect(ics).toContain("SUMMARY:1. Completed Task");
  });

  it("safely handles plans with zero tasks", () => {
    const plan: ICalPlan = {
      id: "plan-empty",
      title: "Empty Plan",
      tasks: [],
    };

    const ics = generatePlanICalendar(plan);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });
});
