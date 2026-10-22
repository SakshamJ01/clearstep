import { ApiError, apiErrorResponse } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { buildPlanExport, type ExportFormat } from "@/lib/export";
import { getPlanDetail } from "@/lib/plans";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const plan = getPlanDetail(id, user.id);
    if (!plan) {
      throw new ApiError(404, "NOT_FOUND", "That plan could not be found.");
    }
    const requested = new URL(request.url).searchParams.get("format");
    const format: ExportFormat = requested === "txt" ? "txt" : "md";
    const exported = buildPlanExport(plan, format);
    return new Response(exported.body, {
      headers: {
        "Content-Type": exported.contentType,
        "Content-Disposition": `attachment; filename="${exported.filename}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
