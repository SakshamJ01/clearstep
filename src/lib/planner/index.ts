import type {
  AiPreference,
  DraftContent,
  GenerationMode,
  PlanningInput,
} from "@/lib/schemas";
import { AiGenerationError, generateWithAi, isAiConfigured } from "@/lib/planner/ai";
import { buildManualDraft } from "@/lib/planner/manual";

export type FallbackKind = "timeout" | "provider" | "invalid" | "unconfigured";

export interface GenerationResult {
  content: DraftContent;
  mode: GenerationMode;
  fallbackReason: string | null;
  fallbackKind: FallbackKind | null;
  model: string | null;
}

function manualResult(
  input: PlanningInput,
  options?: {
    mode?: GenerationMode;
    fallbackReason?: string;
    fallbackKind?: FallbackKind;
  },
): GenerationResult {
  return {
    content: buildManualDraft(input),
    mode: options?.mode ?? "manual",
    fallbackReason: options?.fallbackReason ?? null,
    fallbackKind: options?.fallbackKind ?? null,
    model: null,
  };
}

export async function generatePlanDraft(
  input: PlanningInput,
  aiPreference: AiPreference,
): Promise<GenerationResult> {
  if (!input.aiConsent) {
    return manualResult(input);
  }

  if (aiPreference === "manual_only") {
    return manualResult(input, {
      fallbackReason:
        "AI is turned off in your settings, so this draft was built manually.",
    });
  }

  if (!isAiConfigured()) {
    return manualResult(input, {
      mode: "manual_fallback",
      fallbackKind: "unconfigured",
      fallbackReason:
        "AI drafting is not configured on this server. This manual draft uses only your words.",
    });
  }

  try {
    const result = await generateWithAi(input);
    return {
      content: result.content,
      mode: "ai",
      fallbackReason: null,
      fallbackKind: null,
      model: result.model,
    };
  } catch (error) {
    if (error instanceof AiGenerationError) {
      const fallbackMessages: Record<AiGenerationError["kind"], string> = {
        timeout:
          "The AI draft took too long, so Clearstep built a manual draft instead. Nothing was lost.",
        provider:
          "The AI service was unavailable, so Clearstep built a manual draft instead. Nothing was lost.",
        invalid:
          "The AI response could not be validated, so Clearstep built a manual draft instead. Nothing was lost.",
      };
      return manualResult(input, {
        mode: "manual_fallback",
        fallbackKind: error.kind,
        fallbackReason: fallbackMessages[error.kind],
      });
    }
    return manualResult(input, {
      mode: "manual_fallback",
      fallbackKind: "provider",
      fallbackReason:
        "The AI service could not finish the draft, so Clearstep built a manual draft instead. Nothing was lost.",
    });
  }
}
