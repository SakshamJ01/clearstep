import {
  ApiError,
  apiErrorResponse,
  assertSameOrigin,
  noStoreJson,
  readJson,
  requestIp,
} from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createDraft, findDraftByRequestId, runMaintenance } from "@/lib/drafts";
import { generatePlanDraft } from "@/lib/planner";
import { isAiConfigured } from "@/lib/planner/ai";
import {
  assertAiQuota,
  getAiUsage,
  recordUsageEvent,
} from "@/lib/rate-limit";
import { planningInputSchema } from "@/lib/schemas";
import { hashIdentifier } from "@/lib/secrets";
import { USAGE_EVENT_AI } from "@/lib/constants";
import {
  CRISIS_SUPPORT_DETAIL,
  CRISIS_SUPPORT_MESSAGE,
  containsCrisisLanguage,
} from "@/lib/safety";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    runMaintenance();
    const input = await readJson(request, planningInputSchema);

    if (containsCrisisLanguage(input.dump)) {
      throw new ApiError(
        422,
        "SAFETY_PAUSE",
        CRISIS_SUPPORT_MESSAGE,
        {
          details: {
            supportDetail: CRISIS_SUPPORT_DETAIL,
          },
        },
      );
    }

    const existing = findDraftByRequestId(user.id, input.requestId);
    if (existing) {
      return noStoreJson({
        draftId: existing.id,
        mode: existing.mode,
        fallbackReason: existing.fallbackReason,
        duplicate: true,
      });
    }

    const willAttemptAi =
      input.aiConsent &&
      user.aiPreference !== "manual_only" &&
      isAiConfigured();
    let usage = null;
    if (willAttemptAi) {
      assertAiQuota(user.id, hashIdentifier(requestIp(request)));
      recordUsageEvent(
        user.id,
        USAGE_EVENT_AI,
        hashIdentifier(requestIp(request)),
      );
      usage = getAiUsage(user.id);
    }

    const result = await generatePlanDraft(input, user.aiPreference);

    let draftId: string;
    try {
      draftId = createDraft({
        userId: user.id,
        requestId: input.requestId,
        dump: input.dump,
        outcome: input.outcome,
        horizonDate: input.horizonDate || null,
        availableMinutesPerWeek: input.availableMinutesPerWeek,
        constraints: input.constraints || null,
        aiConsent: input.aiConsent,
        mode: result.mode,
        fallbackReason: result.fallbackReason,
        fallbackKind: result.fallbackKind,
        modelName: result.model,
        content: result.content,
      });
    } catch (error) {
      const raced = findDraftByRequestId(user.id, input.requestId);
      if (raced) {
        return noStoreJson({
          draftId: raced.id,
          mode: raced.mode,
          fallbackReason: raced.fallbackReason,
          duplicate: true,
        });
      }
      throw error;
    }

    return noStoreJson(
      {
        draftId,
        mode: result.mode,
        fallbackReason: result.fallbackReason,
        usage,
      },
      201,
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
