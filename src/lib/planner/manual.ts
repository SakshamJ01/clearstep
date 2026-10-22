import type { DraftContent, DraftTask } from "@/lib/schemas";

export interface ManualPlanInput {
  dump: string;
  outcome: string;
  horizonDate: string | null;
  availableMinutesPerWeek: number | null;
  constraints: string | null;
}

const SKIP_LINE_PATTERNS = [
  /^i(?:'m| am)\s+(?:so\s+)?(?:overwhelmed|anxious|stressed|exhausted|tired|scared)\b/i,
  /^i\s+(?:feel|felt|am\s+feeling)\s+/i,
  /^so\s+much\s+(?:to\s+do|going\s+on)\b/i,
  /^i\s+(?:don'?t|do\s+not)\s+know\s+where\s+to\s+start/i,
  /^(?:hi|hello|hey|dear)\b[^.!?]{0,25}$/i,
  /^(?:help|ugh|argh|okay|ok|hmm)\.?$/i,
];

const BULLET_PREFIX = /^\s*(?:[-*•–—]+|\d+[.)]|\[[ xX]\])\s*/;

function cleanLine(line: string): string {
  return line.replace(BULLET_PREFIX, "").replace(/\s+/g, " ").trim();
}

function splitDump(dump: string): string[] {
  const chunks: string[] = [];
  const lines = dump.replace(/\r\n/g, "\n").split("\n");

  for (const line of lines) {
    const cleanedLine = cleanLine(line);
    if (!cleanedLine) continue;
    const sentences = cleanedLine.split(/(?<=[.!?])\s+(?=[A-Z0-9])/);
    for (const sentence of sentences) {
      const cleaned = sentence.trim();
      if (cleaned.length < 5 || cleaned.length > 600) continue;
      if (SKIP_LINE_PATTERNS.some((pattern) => pattern.test(cleaned))) continue;
      chunks.push(cleaned);
    }
  }

  const seen = new Set<string>();
  return chunks.filter((chunk) => {
    const key = chunk.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function shorten(value: string, max: number): string {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  const sliced = cleaned.slice(0, max - 1);
  const lastSpace = sliced.lastIndexOf(" ");
  return `${(lastSpace > max * 0.55 ? sliced.slice(0, lastSpace) : sliced).trim()}…`;
}

function taskTitle(chunk: string): string {
  let title = chunk
    .replace(/\s+/g, " ")
    .replace(/^(?:todo|to-do|task|remember|note)\s*[:\-]\s*/i, "")
    .replace(
      /^(?:i\s+(?:really\s+)?(?:need|have|want|would\s+like)\s+to|i\s+(?:should|must|gotta|got\s+to)|need\s+to|have\s+to|should|must|remember\s+to|don'?t\s+forget\s+to)\s+/i,
      "",
    )
    .replace(/^[a-z]/, (letter) => letter.toUpperCase())
    .replace(/[.;:,]+$/g, "")
    .trim();

  if (title.length < 3) title = `Do: ${chunk.replace(/[.;:,]+$/g, "")}`;
  title = shorten(title, 110);
  return title.length >= 3 ? title : "Take one small step";
}

function estimateEffort(chunk: string): { min: number; max: number } {
  const words = chunk.split(/\s+/).filter(Boolean).length;
  if (words <= 5) return { min: 10, max: 20 };
  if (words <= 12) return { min: 15, max: 30 };
  if (words <= 25) return { min: 25, max: 45 };
  return { min: 30, max: 60 };
}

function describeMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${hours} ${hours === 1 ? "hour" : "hours"}`;
}

function addFillerTasks(tasks: DraftTask[], outcome: string, target: number): boolean {
  const fillers: Array<{ title: string; description: string }> = [
    {
      title: `Define what "done" looks like`,
      description: `Write one or two sentences describing a finished result for: ${shorten(outcome, 160)}. Make it something you could recognize without guessing.`,
    },
    {
      title: "Choose a first step you can do in 20 minutes",
      description:
        "Pick one action small enough to start today. Rename this task to that specific action once you know it.",
    },
    {
      title: "Set aside one realistic work block",
      description:
        "Choose a day and a time that actually exists in your week, and put that block somewhere you will see it.",
    },
  ];

  let index = 0;
  let used = false;
  while (tasks.length < target && index < fillers.length) {
    const filler = fillers[index++]!;
    tasks.push({
      id: `t${tasks.length + 1}`,
      title: filler.title,
      description: filler.description,
      effortMin: 10,
      effortMax: 20,
      dependsOn: [],
      rationale:
        "A starter task suggested by the manual template because the dump had fewer than three separate items.",
      isAssumption: true,
    });
    used = true;
  }
  return used;
}

export function buildManualDraft(input: ManualPlanInput): DraftContent {
  const rawChunks = splitDump(input.dump);
  const chunks = rawChunks.slice(0, 10);
  const tasks: DraftTask[] = chunks.map((chunk, index) => {
    const effort = estimateEffort(chunk);
    return {
      id: `t${index + 1}`,
      title: taskTitle(chunk),
      description: shorten(chunk, 600),
      effortMin: effort.min,
      effortMax: effort.max,
      dependsOn: [],
      rationale: "Taken from your dump. Manual mode did not add dependencies.",
      isAssumption: false,
    };
  });

  const remaining = rawChunks.slice(10);
  if (remaining.length > 0) {
    const description = shorten(
      `These items were in your dump but are not broken out yet:\n\n${remaining
        .map((item) => `• ${item}`)
        .join("\n")}`,
      600,
    );
    tasks.push({
      id: `t${tasks.length + 1}`,
      title: `Triage the rest of your dump (${remaining.length} items)`,
      description,
      effortMin: 20,
      effortMax: 40,
      dependsOn: [],
      rationale:
        "A holding step so the remaining lines are not lost in the manual draft.",
      isAssumption: false,
    });
  }

  const usedFillers = addFillerTasks(tasks, input.outcome, 3);

  const totalMin = tasks.reduce((sum, task) => sum + (task.effortMin ?? 0), 0);
  const totalMax = tasks.reduce((sum, task) => sum + (task.effortMax ?? 0), 0);
  const assumptions: string[] = [
    "This is a manual draft: Clearstep grouped your own words and did not use AI.",
    "Effort ranges are rough guesses based on the length of each item, not a calendar or a trained estimate.",
    "Manual mode does not create handoffs between steps. Reorder the tasks as you learn more.",
  ];

  if (usedFillers) {
    assumptions.push(
      "Tasks marked as suggestions are starter prompts, not things you explicitly wrote.",
    );
  }
  if (!input.horizonDate) {
    assumptions.push(
      "No deadline was set, so this draft is ordered rather than scheduled.",
    );
  }
  if (!input.availableMinutesPerWeek) {
    assumptions.push(
      "No weekly availability was set, so the draft is not fitted to a specific amount of time.",
    );
  } else if (totalMax > input.availableMinutesPerWeek) {
    assumptions.push(
      `The rough effort total is ${totalMin}–${totalMax} minutes, more than the ${describeMinutes(
        input.availableMinutesPerWeek,
      )} you set for this week. Expect this to span more than one week.`,
    );
  }
  if (remaining.length > 0) {
    assumptions.push(
      "Only the first 10 items were broken out; the rest were grouped so nothing was lost.",
    );
  }

  const facts: string[] = [
    `Desired outcome: ${shorten(input.outcome, 200)}`,
    input.horizonDate
      ? `Deadline: ${input.horizonDate}`
      : "Deadline: none set",
    input.availableMinutesPerWeek
      ? `Available time: ${describeMinutes(input.availableMinutesPerWeek)} per week`
      : "Available time: not set",
  ];
  if (input.constraints) {
    facts.push(`Constraints: ${shorten(input.constraints, 240)}`);
  }
  facts.push(
    `Dump size: ${input.dump.split(/\s+/).filter(Boolean).length} words across ${
      input.dump.split(/\r?\n/).length
    } lines`,
  );

  const clarifyingQuestion =
    chunks.length > 5
      ? "Which of these items needs to move first this week, and which can wait?"
      : !input.availableMinutesPerWeek && !input.horizonDate
        ? "When could you realistically spend time on this, and is there a real deadline?"
        : null;

  return {
    title: shorten(input.outcome.replace(/[.!?]+$/g, ""), 110),
    summary:
      "A manual first pass built from your dump. Nothing here is active yet. Review the order, cut what does not matter, make the first step small enough to begin, and then approve it.",
    statedFacts: facts,
    assumptions: assumptions.slice(0, 8),
    tasks,
    clarifyingQuestion,
    startHereTaskId: tasks[0]?.id ?? null,
  };
}
