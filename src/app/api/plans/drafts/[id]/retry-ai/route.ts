import {
  ApiError,
  apiErrorResponse,
  assertSameOrigin,
  noStoreJson,
  requestIp,
} from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { USAGE_EVENT_AI } from "@/lib/constants";
import { getDraft, updateDraftGeneration } from "@/lib/drafts";
import { generatePlanDraft } from "@/lib/planner";
import { isAiConfigured } from "@/lib/planner/ai";
import { assertAiQuota, recordUsageEvent } from "@/lib/rate-limit";
import type { PlanningInput } from "@/lib/schemas";
import { hashIdentifier } from "@/lib/secrets";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const { id } = await params;
    const draft = getDraft(user.id, id);
    if (!draft) {
      throw new ApiError(404, "NOT_FOUND", "That draft could not be found.");
    }
    if (draft.approvedPlanId) {
      throw new ApiError(
        409,
        "DRAFT_APPROVED",
        "This draft has already been approved.",
      );
    }
    if (!draft.aiConsent) {
      throw new ApiError(
        409,
        "CONSENT_REQUIRED",
        "AI processing was not allowed when this draft was created.",
      );
    }
    if (user.aiPreference === "manual_only") {
      throw new ApiError(
        409,
        "AI_DISABLED",
        "AI is turned off in your settings. Turn it back on to retry.",
      );
    }
    if (!isAiConfigured()) {
      throw new ApiError(
        503,
        "AI_UNAVAILABLE",
        "AI drafting is not configured on this server yet.",
      );
    }
    if (!draft.dump) {
      throw new ApiError(
        409,
        "RAW_DUMP_MISSING",
        "The original dump is no longer retained, so it cannot be sent again.",
      );
    }

    const input: PlanningInput = {
      requestId: draft.requestId,
      dump: draft.dump,
      outcome: draft.outcome,
      horizonDate: draft.horizonDate,
      availableMinutesPerWeek: draft.availableMinutesPerWeek,
      constraints: draft.constraints,
      aiConsent: true,
    };

    assertAiQuota(user.id, hashIdentifier(requestIp(request)));
    recordUsageEvent(
      user.id,
      USAGE_EVENT_AI,
      hashIdentifier(requestIp(request)),
    );
    const result = await generatePlanDraft(input, "ask");
    const updated = updateDraftGeneration({
      userId: user.id,
      draftId: draft.id,
      mode: result.mode,
      fallbackReason: result.fallbackReason,
      fallbackKind: result.fallbackKind,
      modelName: result.model,
      content: result.content,
    });
    if (!updated) {
      throw new ApiError(409, "DRAFT_APPROVED", "This draft can no longer change.");
    }

    return noStoreJson({
      draftId: updated.id,
      mode: updated.mode,
      fallbackReason: updated.fallbackReason,
      content: updated.content,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
