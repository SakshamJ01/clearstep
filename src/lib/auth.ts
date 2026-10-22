import "server-only";

import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { cache } from "react";
import { ApiError } from "@/lib/api";
import { getDb, isoDaysFromNow, nowIso } from "@/lib/db";
import { SESSION_COOKIE, SESSION_DAYS } from "@/lib/constants";
import { aiPreferenceSchema, type AiPreference } from "@/lib/schemas";
import { randomId } from "@/lib/secrets";

export interface SessionUser {
  id: string;
  email: string;
  aiPreference: AiPreference;
  createdAt: string;
}

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  preferences_json: string;
  created_at: string;
}

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function parsePreferences(raw: string): AiPreference {
  try {
    const parsed = JSON.parse(raw) as { aiPreference?: unknown };
    const result = aiPreferenceSchema.safeParse(parsed.aiPreference);
    return result.success ? result.data : "ask";
  } catch {
    return "ask";
  }
}

function toSessionUser(row: UserRow): SessionUser {
  return {
    id: row.id,
    email: row.email,
    aiPreference: parsePreferences(row.preferences_json),
    createdAt: row.created_at,
  };
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt$${salt}$${hash.toString("base64url")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [algorithm, salt, expected] = stored.split("$");
  if (algorithm !== "scrypt" || !salt || !expected) return false;
  try {
    const actual = scryptSync(password, salt, 64, {
      N: 16384,
      r: 8,
      p: 1,
      maxmem: 64 * 1024 * 1024,
    });
    const expectedBuffer = Buffer.from(expected, "base64url");
    return (
      expectedBuffer.length === actual.length &&
      timingSafeEqual(expectedBuffer, actual)
    );
  } catch {
    return false;
  }
}

export function findUserByEmail(email: string): UserRow | null {
  const row = getDb()
    .prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE")
    .get(email) as UserRow | undefined;
  return row ?? null;
}

export function createUser(email: string, password: string): SessionUser {
  const db = getDb();
  const existing = findUserByEmail(email);
  if (existing) {
    throw new ApiError(
      409,
      "EMAIL_TAKEN",
      "An account with that email already exists. Try signing in.",
    );
  }
  const id = randomId();
  const createdAt = nowIso();
  db.prepare(
    `INSERT INTO users (id, email, password_hash, preferences_json, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(
    id,
    email,
    hashPassword(password),
    JSON.stringify({ aiPreference: "ask" }),
    createdAt,
  );
  return { id, email, aiPreference: "ask", createdAt };
}

export function createSession(userId: string): string {
  const db = getDb();
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(nowIso());
  const token = randomBytes(32).toString("base64url");
  db.prepare(
    `INSERT INTO sessions (id, user_id, expires_at, created_at)
     VALUES (?, ?, ?, ?)`,
  ).run(hashSessionToken(token), userId, isoDaysFromNow(SESSION_DAYS), nowIso());
  return token;
}

export function destroySession(rawToken: string | undefined): void {
  if (!rawToken) return;
  getDb()
    .prepare("DELETE FROM sessions WHERE id = ?")
    .run(hashSessionToken(rawToken));
}

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = await getSessionToken();
  if (!token) return null;
  const row = getDb()
    .prepare(
      `SELECT u.* FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > ?`,
    )
    .get(hashSessionToken(token), nowIso()) as UserRow | undefined;
  return row ? toSessionUser(row) : null;
}

export const getCurrentUser = cache(getSessionUser);

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new ApiError(401, "UNAUTHORIZED", "Sign in to continue.");
  }
  return user;
}

export async function updateAiPreference(
  userId: string,
  preference: AiPreference,
): Promise<void> {
  getDb()
    .prepare("UPDATE users SET preferences_json = ? WHERE id = ?")
    .run(JSON.stringify({ aiPreference: preference }), userId);
}
