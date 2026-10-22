import { NextResponse } from "next/server";
import type { ZodType } from "zod";

const JSON_BODY_LIMIT = 64 * 1024;

export class ApiError extends Error {
  status: number;
  code: string;
  fields?: Record<string, string>;
  retryAfterSeconds?: number;
  details?: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    options?: {
      fields?: Record<string, string>;
      retryAfterSeconds?: number;
      details?: Record<string, unknown>;
    },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = options?.fields;
    this.retryAfterSeconds = options?.retryAfterSeconds;
    this.details = options?.details;
  }
}

export function apiErrorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    const response = NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.fields ? { fields: error.fields } : {}),
          ...(error.details ? { details: error.details } : {}),
        },
      },
      { status: error.status },
    );
    if (error.retryAfterSeconds) {
      response.headers.set("Retry-After", String(error.retryAfterSeconds));
    }
    return response;
  }

  console.error(
    "Unhandled API error:",
    error instanceof Error ? error.name : "unknown",
  );
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL",
        message:
          "Something went wrong on our side. Your input is still preserved.",
      },
    },
    { status: 500 },
  );
}

export function assertSameOrigin(request: Request): void {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const origin = request.headers.get("origin");
  if (!origin) return;
  const allowedHost =
    request.headers.get("x-forwarded-host") || request.headers.get("host");
  try {
    if (!allowedHost || new URL(origin).host !== allowedHost) {
      throw new ApiError(403, "ORIGIN", "This request came from an unexpected origin.");
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(403, "ORIGIN", "This request came from an unexpected origin.");
  }
}

export async function readJson<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<T> {
  const length = Number(request.headers.get("content-length") || "0");
  if (length > JSON_BODY_LIMIT) {
    throw new ApiError(413, "TOO_LARGE", "That request is too large.");
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Send a valid JSON request.");
  }

  if (JSON.stringify(raw).length > JSON_BODY_LIMIT) {
    throw new ApiError(413, "TOO_LARGE", "That request is too large.");
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "form";
      if (!fields[key]) fields[key] = issue.message;
    }
    throw new ApiError(
      400,
      "VALIDATION",
      parsed.error.issues[0]?.message || "Check the highlighted fields.",
      { fields },
    );
  }
  return parsed.data;
}

export function requestIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") || "local";
}

export function noStoreJson(data: unknown, status = 200): NextResponse {
  const response = NextResponse.json(data, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
