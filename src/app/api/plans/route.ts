import {
  ApiError,
  apiErrorResponse,
  assertSameOrigin,
  noStoreJson,
  readJson,
} from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getDraft } from "@/lib/drafts";
import {
  createApprovedPlan,
  getPlansForUser,
} from "@/lib/plans";
import { DraftContentError, normalizeDraftContent } from "@/lib/planner/draft";
import { approvalSchema } from "@/lib/schemas";

export async function GET() {
  try {
    const user = await requireUser();
    return noStoreJson({ plans: getPlansForUser(user.id) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const input = await readJson(request, approvalSchema);
    const draft = getDraft(user.id, input.draftId);
    if (!draft) {
      throw new ApiError(404, "NOT_FOUND", "That draft could not be found.");
    }
    if (draft.approvedPlanId) {
      return noStoreJson({ planId: draft.approvedPlanId }, 200);
    }

    let content;
    try {
      content = normalizeDraftContent(input.content);
    } catch (error) {
      if (error instanceof DraftContentError) {
        throw new ApiError(
          400,
          "INVALID_DRAFT",
          "Fix the draft before approving it.",
          { details: { reason: error.message } },
        );
      }
      throw error;
    }

    const planId = createApprovedPlan(draft, content);
    return noStoreJson({ planId }, 201);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
