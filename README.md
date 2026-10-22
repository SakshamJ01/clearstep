# Clearstep

Clearstep turns an unstructured brain dump into a small, editable plan that starts with one clear action. AI is optional and consent-gated. Manual planning works without a provider.

This repository is an MVP, not a task manager or an autonomous agent. It does not send emails, connect integrations, or act on a plan without explicit approval.

## What is included

- Email/password accounts with hashed sessions and HTTP-only cookies.
- Optional OpenAI-compatible AI drafts with a deterministic manual fallback.
- Draft review before anything becomes active: edit, reorder, add, delete, and choose a start task.
- Explicit plan approval, task statuses, notes, archive/restore, Markdown/text export, and deletion.
- Deterministic re-plan previews that preserve completed work and notes until accepted.
- AI consent off by default, per-user preferences, usage quotas, and encrypted raw brain dumps.
- Local retention rules and account-level data controls.
- Crisis-language pause before any provider call.
- Responsive UI, keyboard-accessible controls, reduced-motion support, and a PWA shell.

## Stack

Next.js 16 (App Router), React 19, TypeScript, SQLite via `better-sqlite3`, Zod, and Vitest. Styling is plain CSS in `src/app/globals.css`; fonts are self-hosted through Fontsource.

## Requirements

- Node.js 20.9 or newer (developed on Node 24).
- A writable directory for the SQLite database.
- Optional: an OpenAI-compatible chat-completions endpoint for AI drafts.

## Quick start

```bash
npm install
copy .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

Without `APP_SECRET`, the app creates a persistent secret in `data/.app-secret`. On first run it also creates `data/clearstep.db`. Both are ignored by Git.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `APP_SECRET` | No | Encrypts dumps and signs rate-limit identifiers. Generated and stored locally if omitted. |
| `DATABASE_PATH` | No | SQLite file path. Defaults to `./data/clearstep.db`. |
| `LLM_API_KEY` | No | Enables AI drafts when all required provider settings are present. |
| `LLM_BASE_URL` | No | OpenAI-compatible base URL. Defaults to `https://api.openai.com/v1`. |
| `LLM_MODEL` | No | Provider model name. Defaults to `gpt-4o-mini`. |
| `LLM_PROVIDER_NAME` | No | Provider name shown in consent copy. Defaults to `OpenAI`. |

Set a stable `APP_SECRET` in any real deployment. Changing it makes existing encrypted dumps unreadable.

## Scripts

```bash
npm run dev        # development server
npm run build      # production build
npm start          # serve the production build
npm run typecheck  # TypeScript, no emit
npm run lint       # ESLint
npm test           # Vitest, single run
npm run test:watch # Vitest in watch mode
```

## Data and privacy

- Brain dumps are encrypted with AES-256-GCM before storage. Auth cookies contain a random token; only its hash is stored.
- AI consent is requested per draft and is not persisted. Without consent, the dump never leaves the app.
- With consent, only the dump and planning fields are sent to the configured provider. Plan history, email, and account data are not included.
- AI output is treated as untrusted. It is validated, capped at 20 tasks, stripped of invalid dependencies, and checked for cycles before review.
- Unapproved drafts are removed after 7 days. Raw dumps attached to saved plans are cleared after 30 days.
- AI use is limited to 10 drafts per hour and 30 per day per user, with additional per-IP limits. Manual planning is unlimited.
- AI requests use a client-generated request id so retries do not create duplicate drafts.
- Crisis phrases pause planning and skip the provider call. Clearstep is not a crisis service or a substitute for professional advice.
- Settings provides export, retained-dump clearing, AI preference, and account deletion. Deleting an account removes its plans, drafts, sessions, and usage records.

## Deployment

1. Set `APP_SECRET` and `DATABASE_PATH`.
2. Mount a persistent volume at the database directory.
3. Run `npm run build`, then `npm start`.

SQLite is suitable for a single app instance. Do not run multiple writers against the same database file without changing the storage layer. Use HTTPS, keep the database volume private, and back it up together with `APP_SECRET`.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

The automated tests cover manual drafting, draft normalization, crisis detection, and deterministic re-planning. Authenticated browser/API smoke tests should be rerun after changes to routes, sessions, or task flows.
