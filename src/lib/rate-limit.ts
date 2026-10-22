import "server-only";

import {
  AI_DRAFTS_PER_DAY,
  AI_DRAFTS_PER_HOUR,
  AI_IP_DRAFTS_PER_DAY,
  AI_IP_DRAFTS_PER_HOUR,
  USAGE_EVENT_AI,
} from "@/lib/constants";
import { getDb, isoDaysAgo, nowIso } from "@/lib/db";
import { ApiError } from "@/lib/api";

export interface UsageSummary {
  usedThisHour: number;
  usedToday: number;
  hourlyLimit: number;
  dailyLimit: number;
  resetsAt: string | null;
}

function countEvents(options: {
  eventType: string;
  since: string;
  userId?: string;
  ipHash?: string;
}): number {
  const conditions = ["event_type = ?", "created_at > ?"];
  const values: unknown[] = [options.eventType, options.since];
  if (options.userId) {
    conditions.push("user_id = ?");
    values.push(options.userId);
  }
  if (options.ipHash) {
    conditions.push("ip_hash = ?");
    values.push(options.ipHash);
  }
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS count FROM usage_events WHERE ${conditions.join(" AND ")}`,
    )
    .get(...values) as { count: number };
  return row.count;
}

function oldestEvent(options: {
  eventType: string;
  since: string;
  userId?: string;
  ipHash?: string;
}): string | null {
  const conditions = ["event_type = ?", "created_at > ?"];
  const values: unknown[] = [options.eventType, options.since];
  if (options.userId) {
    conditions.push("user_id = ?");
    values.push(options.userId);
  }
  if (options.ipHash) {
    conditions.push("ip_hash = ?");
    values.push(options.ipHash);
  }
  const row = getDb()
    .prepare(
      `SELECT MIN(created_at) AS oldest FROM usage_events WHERE ${conditions.join(" AND ")}`,
    )
    .get(...values) as { oldest: string | null };
  return row.oldest;
}

function secondsUntilFree(oldest: string | null, windowMs: number): number {
  if (!oldest) return Math.ceil(windowMs / 1000);
  const elapsed = Date.now() - new Date(oldest).getTime();
  return Math.max(1, Math.ceil((windowMs - elapsed) / 1000));
}

export function recordUsageEvent(
  userId: string | null,
  eventType: string,
  ipHash?: string | null,
): void {
  getDb()
    .prepare(
      `INSERT INTO usage_events (user_id, event_type, ip_hash, created_at)
       VALUES (?, ?, ?, ?)`,
    )
    .run(userId, eventType, ipHash ?? null, nowIso());
}

export function getAiUsage(userId: string): UsageSummary {
  const hourAgo = isoDaysAgo(1 / 24);
  const dayAgo = isoDaysAgo(1);
  const usedThisHour = countEvents({
    eventType: USAGE_EVENT_AI,
    since: hourAgo,
    userId,
  });
  const usedToday = countEvents({
    eventType: USAGE_EVENT_AI,
    since: dayAgo,
    userId,
  });
  const oldestHour = oldestEvent({
    eventType: USAGE_EVENT_AI,
    since: hourAgo,
    userId,
  });
  const oldestDay = oldestEvent({
    eventType: USAGE_EVENT_AI,
    since: dayAgo,
    userId,
  });

  let resetsAt: string | null = null;
  if (usedThisHour >= AI_DRAFTS_PER_HOUR && oldestHour) {
    resetsAt = new Date(
      new Date(oldestHour).getTime() + 60 * 60 * 1000,
    ).toISOString();
  } else if (usedToday >= AI_DRAFTS_PER_DAY && oldestDay) {
    resetsAt = new Date(
      new Date(oldestDay).getTime() + 24 * 60 * 60 * 1000,
    ).toISOString();
  }

  return {
    usedThisHour,
    usedToday,
    hourlyLimit: AI_DRAFTS_PER_HOUR,
    dailyLimit: AI_DRAFTS_PER_DAY,
    resetsAt,
  };
}

export function assertAiQuota(userId: string, ipHash: string): UsageSummary {
  const usage = getAiUsage(userId);
  const hourAgo = isoDaysAgo(1 / 24);
  const dayAgo = isoDaysAgo(1);

  if (usage.usedThisHour >= AI_DRAFTS_PER_HOUR) {
    const oldest = oldestEvent({
      eventType: USAGE_EVENT_AI,
      since: hourAgo,
      userId,
    });
    const retry = secondsUntilFree(oldest, 60 * 60 * 1000);
    throw new ApiError(
      429,
      "RATE_LIMITED",
      `You've used your ${AI_DRAFTS_PER_HOUR} AI drafts for this hour. Manual planning still works and costs nothing.`,
      { retryAfterSeconds: retry },
    );
  }

  if (usage.usedToday >= AI_DRAFTS_PER_DAY) {
    const oldest = oldestEvent({
      eventType: USAGE_EVENT_AI,
      since: dayAgo,
      userId,
    });
    const retry = secondsUntilFree(oldest, 24 * 60 * 60 * 1000);
    throw new ApiError(
      429,
      "RATE_LIMITED",
      `You've used your ${AI_DRAFTS_PER_DAY} AI drafts for today. Manual planning is still available.`,
      { retryAfterSeconds: retry },
    );
  }

  const ipHourCount = countEvents({
    eventType: USAGE_EVENT_AI,
    since: hourAgo,
    ipHash,
  });
  if (ipHourCount >= AI_IP_DRAFTS_PER_HOUR) {
    const oldest = oldestEvent({
      eventType: USAGE_EVENT_AI,
      since: hourAgo,
      ipHash,
    });
    const retry = secondsUntilFree(oldest, 60 * 60 * 1000);
    throw new ApiError(
      429,
      "RATE_LIMITED",
      "This network has made a lot of AI requests this hour. Try again shortly or use manual planning.",
      { retryAfterSeconds: retry },
    );
  }

  const ipDayCount = countEvents({
    eventType: USAGE_EVENT_AI,
    since: dayAgo,
    ipHash,
  });
  if (ipDayCount >= AI_IP_DRAFTS_PER_DAY) {
    const oldest = oldestEvent({
      eventType: USAGE_EVENT_AI,
      since: dayAgo,
      ipHash,
    });
    const retry = secondsUntilFree(oldest, 24 * 60 * 60 * 1000);
    throw new ApiError(
      429,
      "RATE_LIMITED",
      "This network has reached its daily AI limit. Manual planning still works.",
      { retryAfterSeconds: retry },
    );
  }

  return usage;
}

export function assertAuthAttemptAllowed(
  eventType: string,
  ipHash: string,
  limit: number,
  windowMs: number,
): void {
  const since = new Date(Date.now() - windowMs).toISOString();
  const count = countEvents({ eventType, since, ipHash });
  if (count >= limit) {
    const oldest = oldestEvent({ eventType, since, ipHash });
    throw new ApiError(
      429,
      "RATE_LIMITED",
      "Too many attempts. Wait a little, then try again.",
      { retryAfterSeconds: secondsUntilFree(oldest, windowMs) },
    );
  }
}

export function cleanupUsageEvents(): void {
  getDb()
    .prepare("DELETE FROM usage_events WHERE created_at < ?")
    .run(isoDaysAgo(90));
}
