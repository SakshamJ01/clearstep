import "server-only";

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { getDatabasePath, getDataDir } from "@/lib/secrets";

let database: Database.Database | null = null;

function migrate(db: Database.Database): void {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      preferences_json TEXT NOT NULL DEFAULT '{"aiPreference":"ask"}',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      desired_outcome TEXT NOT NULL,
      horizon_date TEXT,
      available_minutes_per_week INTEGER,
      constraints_text TEXT,
      source_dump TEXT,
      status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('draft', 'active', 'completed', 'archived')),
      generation_mode TEXT NOT NULL
        CHECK (generation_mode IN ('ai', 'manual', 'manual_fallback')),
      start_task_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      effort_min INTEGER,
      effort_max INTEGER,
      status TEXT NOT NULL DEFAULT 'not_started'
        CHECK (status IN ('not_started', 'in_progress', 'done', 'blocked')),
      sort_order INTEGER NOT NULL DEFAULT 0,
      rationale TEXT,
      note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS task_dependencies (
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      depends_on_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      PRIMARY KEY (task_id, depends_on_task_id),
      CHECK (task_id <> depends_on_task_id)
    );

    CREATE TABLE IF NOT EXISTS plan_revisions (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
      revision_number INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'cancelled')),
      assumptions_json TEXT NOT NULL DEFAULT '[]',
      changes_json TEXT NOT NULL DEFAULT '[]',
      payload_json TEXT NOT NULL,
      model_version TEXT,
      created_at TEXT NOT NULL,
      accepted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS plan_drafts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      request_id TEXT NOT NULL,
      source_dump TEXT NOT NULL,
      outcome TEXT NOT NULL,
      horizon_date TEXT,
      available_minutes_per_week INTEGER,
      constraints_text TEXT,
      ai_consent INTEGER NOT NULL DEFAULT 0,
      generation_mode TEXT NOT NULL
        CHECK (generation_mode IN ('ai', 'manual', 'manual_fallback')),
      fallback_reason TEXT,
      fallback_kind TEXT,
      model_name TEXT,
      content_json TEXT NOT NULL,
      approved_plan_id TEXT REFERENCES plans(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, request_id)
    );

    CREATE TABLE IF NOT EXISTS usage_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      ip_hash TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_plans_user ON plans(user_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_tasks_plan ON tasks(plan_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_dependencies_depends_on
      ON task_dependencies(depends_on_task_id);
    CREATE INDEX IF NOT EXISTS idx_revisions_plan
      ON plan_revisions(plan_id, revision_number DESC);
    CREATE INDEX IF NOT EXISTS idx_plan_drafts_user
      ON plan_drafts(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_usage_user_time
      ON usage_events(user_id, event_type, created_at);
    CREATE INDEX IF NOT EXISTS idx_usage_ip_time
      ON usage_events(ip_hash, event_type, created_at);
  `);
}

export function getDb(): Database.Database {
  if (database) return database;

  mkdirSync(getDataDir(), { recursive: true });
  database = new Database(getDatabasePath());
  migrate(database);
  return database;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}
