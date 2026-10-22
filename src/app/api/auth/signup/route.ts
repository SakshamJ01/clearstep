import { ApiError, apiErrorResponse, assertSameOrigin, noStoreJson, readJson, requestIp } from "@/lib/api";
import {
  createSession,
  createUser,
  setSessionCookie,
} from "@/lib/auth";
import { USAGE_EVENT_SIGNUP } from "@/lib/constants";
import {
  assertAuthAttemptAllowed,
  recordUsageEvent,
} from "@/lib/rate-limit";
import { signupSchema } from "@/lib/schemas";
import { hashIdentifier } from "@/lib/secrets";
import { runMaintenance } from "@/lib/drafts";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    runMaintenance();
    const ipHash = hashIdentifier(requestIp(request));
    assertAuthAttemptAllowed(
      USAGE_EVENT_SIGNUP,
      ipHash,
      10,
      24 * 60 * 60 * 1000,
    );
    recordUsageEvent(null, USAGE_EVENT_SIGNUP, ipHash);

    const input = await readJson(request, signupSchema);
    const user = createUser(input.email, input.password);
    const token = createSession(user.id);
    const response = noStoreJson(
      {
        user: {
          id: user.id,
          email: user.email,
          aiPreference: user.aiPreference,
        },
      },
      201,
    );
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    if (error instanceof ApiError) return apiErrorResponse(error);
    return apiErrorResponse(error);
  }
}
