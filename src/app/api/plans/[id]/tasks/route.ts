import {
  ApiError,
  apiErrorResponse,
  assertSameOrigin,
  noStoreJson,
  readJson,
} from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { addTaskForUser, reorderTasksForUser } from "@/lib/plans";
import { taskCreateSchema, taskOrderSchema } from "@/lib/schemas";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const { id } = await params;
    const input = await readJson(request, taskOrderSchema);
    const result = reorderTasksForUser(id, user.id, input);
    if (!result) {
      throw new ApiError(404, "NOT_FOUND", "That plan could not be found.");
    }
    return noStoreJson({ ok: true, reordered: result.reordered });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const { id } = await params;
    const input = await readJson(request, taskCreateSchema);
    const result = addTaskForUser(id, user.id, input);
    if (!result) {
      throw new ApiError(404, "NOT_FOUND", "That plan could not be found.");
    }
    return noStoreJson(
      {
        ok: true,
        planId: id,
        taskId: result.taskId,
        sortOrder: result.sortOrder,
      },
      201,
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
