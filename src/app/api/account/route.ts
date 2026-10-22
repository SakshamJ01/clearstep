import {
  ApiError,
  apiErrorResponse,
  assertSameOrigin,
  noStoreJson,
  readJson,
} from "@/lib/api";
import {
  clearSessionCookie,
  destroySession,
  getSessionToken,
  requireUser,
} from "@/lib/auth";
import { getDb } from "@/lib/db";
import { accountDeleteSchema } from "@/lib/schemas";

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    await readJson(request, accountDeleteSchema);
    const token = await getSessionToken();

    const result = getDb()
      .prepare("DELETE FROM users WHERE id = ?")
      .run(user.id);
    if (result.changes === 0) {
      throw new ApiError(404, "NOT_FOUND", "That account no longer exists.");
    }
    destroySession(token);

    const response = noStoreJson({ ok: true });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
