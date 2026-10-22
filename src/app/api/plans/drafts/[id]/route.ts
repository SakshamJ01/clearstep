import {
  ApiError,
  apiErrorResponse,
  assertSameOrigin,
  noStoreJson,
  readJson,
} from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { deleteDraft, getDraft, updateDraftContent } from "@/lib/drafts";
import { DraftContentError, normalizeDraftContent } from "@/lib/planner/draft";
import { draftUpdateSchema } from "@/lib/schemas";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const { id } = await params;
    const input = await readJson(request, draftUpdateSchema);
    const draft = getDraft(user.id, id);
    if (!draft) {
      throw new ApiError(404, "NOT_FOUND", "That draft could not be found.");
    }
    if (draft.approvedPlanId) {
      throw new ApiError(
        409,
        "DRAFT_APPROVED",
        "This draft has already been approved.",
        { details: { planId: draft.approvedPlanId } },
      );
    }

    let content;
    try {
      content = normalizeDraftContent(input.content);
    } catch (error) {
      if (error instanceof DraftContentError) {
        throw new ApiError(400, "INVALID_DRAFT", error.message);
      }
      throw error;
    }

    const updated = updateDraftContent(user.id, id, content);
    if (!updated) {
      throw new ApiError(
        409,
        "DRAFT_APPROVED",
        "This draft can no longer be edited.",
      );
    }

    return noStoreJson({ content: updated.content });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(
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
        "Approved drafts can be deleted from the plan page.",
        { details: { planId: draft.approvedPlanId } },
      );
    }
    deleteDraft(user.id, id);
    return noStoreJson({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
