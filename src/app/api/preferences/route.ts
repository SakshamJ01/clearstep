import {
  apiErrorResponse,
  assertSameOrigin,
  noStoreJson,
  readJson,
} from "@/lib/api";
import { requireUser, updateAiPreference } from "@/lib/auth";
import { preferencesSchema } from "@/lib/schemas";

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const input = await readJson(request, preferencesSchema);
    updateAiPreference(user.id, input.aiPreference);
    return noStoreJson({ ok: true, aiPreference: input.aiPreference });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
