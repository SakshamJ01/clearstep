import {
  apiErrorResponse,
  assertSameOrigin,
  noStoreJson,
} from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { clearRawDumpsForUser } from "@/lib/plans";

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const cleared = clearRawDumpsForUser(user.id);
    return noStoreJson({ ok: true, cleared });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
