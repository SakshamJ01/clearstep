import {
  ApiError,
  apiErrorResponse,
  assertSameOrigin,
  noStoreJson,
  readJson,
} from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { deleteTaskForUser, updateTaskForUser } from "@/lib/plans";
import { taskPatchSchema } from "@/lib/schemas";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const { id } = await params;
    const input = await readJson(request, taskPatchSchema);
    const result = updateTaskForUser(id, user.id, input);
    if (!result) {
      throw new ApiError(404, "NOT_FOUND", "That task could not be found.");
    }
    return noStoreJson({ ok: true, planId: result.planId });
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
    const result = deleteTaskForUser(id, user.id);
    if (!result) {
      throw new ApiError(404, "NOT_FOUND", "That task could not be found.");
    }
    return noStoreJson({ ok: true, planId: result.planId });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
