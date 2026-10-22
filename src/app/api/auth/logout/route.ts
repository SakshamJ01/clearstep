import { apiErrorResponse, assertSameOrigin, noStoreJson } from "@/lib/api";
import {
  clearSessionCookie,
  destroySession,
  getSessionToken,
} from "@/lib/auth";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const token = await getSessionToken();
    destroySession(token);
    const response = noStoreJson({ ok: true });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
