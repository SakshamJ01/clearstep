import {
  ApiError,
  apiErrorResponse,
  assertSameOrigin,
  noStoreJson,
  readJson,
} from "@/lib/api";
import { requireUser } from "@/lib/auth";
import {
  deletePlanForUser,
  getPlanDetail,
  updatePlanRecord,
} from "@/lib/plans";
import { planPatchSchema } from "@/lib/schemas";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const plan = getPlanDetail(id, user.id);
    if (!plan) {
      throw new ApiError(404, "NOT_FOUND", "That plan could not be found.");
    }
    return noStoreJson({ plan });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const { id } = await params;
    const input = await readJson(request, planPatchSchema);
    const updated = updatePlanRecord(id, user.id, input);
    if (!updated) {
      throw new ApiError(404, "NOT_FOUND", "That plan could not be found.");
    }
    return noStoreJson({ ok: true });
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
    const deleted = deletePlanForUser(id, user.id);
    if (!deleted) {
      throw new ApiError(404, "NOT_FOUND", "That plan could not be found.");
    }
    return noStoreJson({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
