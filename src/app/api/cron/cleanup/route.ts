import {
  apiErrorResponse,
  ApiError,
  noStoreJson,
} from "@/lib/api";
import { executeMaintenance } from "@/lib/drafts";
import { nowIso } from "@/lib/db";

function verifyCronSecret(request: Request): void {
  const configured = process.env.CRON_SECRET?.trim();
  if (!configured) {
    // If no secret configured in development, allow local invocation.
    if (process.env.NODE_ENV === "production") {
      throw new ApiError(
        500,
        "CONFIGURATION",
        "CRON_SECRET is required in production.",
      );
    }
    return;
  }

  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;
  const customHeader = request.headers.get("x-cron-secret")?.trim();

  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret")?.trim();

  const provided = bearerToken || customHeader || querySecret;
  if (provided !== configured) {
    throw new ApiError(401, "UNAUTHORIZED", "Invalid or missing cron secret.");
  }
}

export async function POST(request: Request) {
  try {
    verifyCronSecret(request);
    const stats = executeMaintenance();
    return noStoreJson({
      ok: true,
      stats,
      executedAt: nowIso(),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function GET(request: Request) {
  try {
    verifyCronSecret(request);
    const stats = executeMaintenance();
    return noStoreJson({
      ok: true,
      stats,
      executedAt: nowIso(),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
