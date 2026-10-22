import { ApiError, apiErrorResponse, assertSameOrigin, noStoreJson, readJson, requestIp } from "@/lib/api";
import {
  createSession,
  findUserByEmail,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { USAGE_EVENT_LOGIN_FAILURE } from "@/lib/constants";
import {
  assertAuthAttemptAllowed,
  recordUsageEvent,
} from "@/lib/rate-limit";
import { loginSchema } from "@/lib/schemas";
import { hashIdentifier } from "@/lib/secrets";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ipHash = hashIdentifier(requestIp(request));
    assertAuthAttemptAllowed(
      USAGE_EVENT_LOGIN_FAILURE,
      ipHash,
      20,
      60 * 60 * 1000,
    );
    const input = await readJson(request, loginSchema);
    const row = findUserByEmail(input.email);
    if (!row || !verifyPassword(input.password, row.password_hash)) {
      recordUsageEvent(null, USAGE_EVENT_LOGIN_FAILURE, ipHash);
      throw new ApiError(
        401,
        "INVALID_CREDENTIALS",
        "That email and password do not match.",
      );
    }

    const token = createSession(row.id);
    const prefs = JSON.parse(row.preferences_json) as {
      aiPreference?: "ask" | "manual_only";
    };
    const response = noStoreJson({
      user: {
        id: row.id,
        email: row.email,
        aiPreference: prefs.aiPreference === "manual_only" ? "manual_only" : "ask",
      },
    });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
