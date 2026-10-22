import {
  ApiError,
  apiErrorResponse,
  assertSameOrigin,
  noStoreJson,
  readJson,
} from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getPlanDetail } from "@/lib/plans";
import { createReplanRevision } from "@/lib/revisions";
import {
  isValidDateString,
  replanInputSchema,
  todayIso,
} from "@/lib/schemas";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const { id } = await params;
    const input = await readJson(request, replanInputSchema);

    const plan = getPlanDetail(id, user.id);
    if (!plan) {
      throw new ApiError(404, "NOT_FOUND", "That plan could not be found.");
    }
    if (plan.status === "archived") {
      throw new ApiError(
        409,
        "PLAN_ARCHIVED",
        "Restore this plan before re-planning it.",
      );
    }
    if (
      input.horizonDate !== undefined &&
      input.horizonDate !== null &&
      (!isValidDateString(input.horizonDate) ||
        input.horizonDate < todayIso())
    ) {
      throw new ApiError(
        400,
        "VALIDATION",
        "The deadline must be today or later.",
        { fields: { horizonDate: "The deadline must be today or later." } },
      );
    }

    const result = createReplanRevision({
      planId: id,
      userId: user.id,
      horizonDate: input.horizonDate,
      availableMinutesPerWeek: input.availableMinutesPerWeek,
    });
    if (!result) {
      throw new ApiError(404, "NOT_FOUND", "That plan could not be found.");
    }

    return noStoreJson(
      {
        revisionId: result.revision.id,
        revisionNumber: result.revision.number,
      },
      201,
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
