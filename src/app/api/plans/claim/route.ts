import {
  ApiError,
  apiErrorResponse,
  assertSameOrigin,
  noStoreJson,
  readJson,
} from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { guestPlanSchema } from "@/lib/guest-storage";
import { createClaimedPlan } from "@/lib/plans";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const guestPlan = await readJson(request, guestPlanSchema);

    if (!guestPlan.tasks || guestPlan.tasks.length === 0) {
      throw new ApiError(
        400,
        "INVALID_PLAN",
        "Guest plan must have at least one task to be saved.",
      );
    }

    const planId = createClaimedPlan(user.id, guestPlan);
    return noStoreJson({ planId }, 201);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
