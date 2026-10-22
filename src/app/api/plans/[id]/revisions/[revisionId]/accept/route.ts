import {
  ApiError,
  apiErrorResponse,
  assertSameOrigin,
  noStoreJson,
} from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { acceptRevision } from "@/lib/revisions";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; revisionId: string }> },
) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const { id, revisionId } = await params;
    const result = acceptRevision(id, revisionId, user.id);
    if (!result) {
      throw new ApiError(
        404,
        "NOT_FOUND",
        "That re-plan could not be found.",
      );
    }
    return noStoreJson({ ok: true, planId: result.planId });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
