# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Reverse AI Studio** — a video intelligence platform for warehouse/retail inspection. Videos are uploaded, frames are extracted, objects annotated, and YOLO models trained from that dataset.

The repo is a monorepo: Python FastAPI backend + React/TypeScript frontend (`reverse-ai-studio/`). Note: `reverse-ai-studio/` is tracked as a git submodule pointer (no `.git` inside) — frontend file changes are **not** committed via the parent repo's git.

---

## Commands

### Backend

```bash
# Run full stack (backend + workers + postgres + redis)
make dev

# Rebuild Docker images first
make dev-build

# Run tests
make test
make test-cov

# Lint + type check
make lint          # ruff check + mypy
make format        # ruff format --fix

# Alembic migrations
make migrate                    # apply pending migrations
make migration MSG="add col x"  # generate new migration

# Shell access
make shell-backend
make shell-db
make shell-redis
```

### Frontend (`reverse-ai-studio/`)

```bash
npm run dev       # Vite dev server (port 5173)
npm run build     # tsc -b && vite build
npm run lint      # oxlint
npm run preview   # preview production build
```

---

## Architecture

### Backend (`backend/`)

**Entry point**: `backend/app/main.py` — mounts all routers under `/api/v1`, registers middleware stack, manages lifespan (DB pool + Redis pool).

**Module structure**: Each feature lives in `backend/app/modules/<name>/` with 4 files:
- `models.py` — SQLAlchemy ORM model
- `schemas.py` — Pydantic request/response schemas
- `router.py` — FastAPI router with endpoints
- `service.py` — business logic (injected with `AsyncSession`)

**Modules**: `auth`, `video`, `dataset`, `annotation`, `training`, `inspector`, `analytics`, `integration`

**Auth flow**: `backend/app/dependencies.py` — HTTPBearer → JWT decode (HS256) → `CurrentUser`. Use `Depends(get_current_user)` on all protected endpoints. Role gating: `Depends(require_roles(Role.admin, Role.ai_engineer))`.

**Database**: SQLAlchemy async (asyncpg driver). `get_db()` dependency provides an `AsyncSession` that auto-commits on success. Pool: size=10, max_overflow=20.

**Job queue**: Redis list-based (`backend/app/core/redis.py`). `enqueue_job(queue_name, payload)` pushes JSON; workers run as separate Docker containers that `dequeue_job()` in a loop. Current queues: `queue:frame_extraction`, `queue:ocr`, `queue:training`, `queue:inference`.

**Middleware order** (outermost → innermost): RequestID → Logging → RateLimit (200 req/min) → CORS.

**Config**: `backend/app/config.py` — Pydantic `Settings` loaded from `backend/.env`. Key properties: `ASYNC_DATABASE_URL` (with asyncpg driver), `CORS_ORIGINS` (JSON array string).

### Frontend (`reverse-ai-studio/src/`)

**API layer**: `src/services/api.ts` — single `api` object with namespaced methods (`api.videos.*`, `api.auth.*`, etc.). Uses native `fetch` with Bearer token from `localStorage('access_token')`. Auto-redirects to `/login` on 401. Base URL: `VITE_API_URL` env var.

**Data fetching**: TanStack React Query v5. All server state lives in query/mutation hooks in `src/hooks/`. Mutations call `queryClient.invalidateQueries` on success to keep lists fresh.

**Routing**: React Router v7, all pages rendered under `AppLayout`. Pages in `src/pages/`.

**Components**: Custom primitives (`Button`, `Modal`, `Input`, `Select`, `Badge`) wrap Radix UI. Use CVA (`class-variance-authority`) for variant props. Tailwind 4 for styling.

---

## Environment Variables

**Backend** (`backend/.env`):
```
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/reverse_ai
REDIS_URL=redis://localhost:6379/0
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_STORAGE_BUCKET=reverse-ai-storage
JWT_SECRET=change-me
CORS_ORIGINS=["http://localhost:5173"]
```

**Frontend** (`reverse-ai-studio/.env`):
```
VITE_API_URL=http://localhost:8000/api/v1
```

---

## Key Conventions

- All backend I/O is `async/await` — never use synchronous DB or HTTP calls inside route handlers.
- Service classes take `db: AsyncSession` in `__init__` and call `await self.db.flush()` (not `commit`) — the router dependency handles commit.
- `enqueue_job()` returns a `job_id` string; the endpoint should return it to the client so the frontend can poll status.
- Frontend mutations always invalidate the relevant query key on success — don't manually update cache.
- `video/import-url` downloads via `httpx` async stream in-process (simulate only — replace `content = b"".join(...)` with real storage write for production).

---

## Deployment

- **Frontend**: Deployed to Vercel (`reverse-ai-studio/`). URL: `https://reverse-ai-platform.vercel.app`
- **Backend**: Deployed to Vercel as a Python serverless function. Entry point: `backend/api/index.py` → `app.main:app`. URL: `https://reverse-ai-platform.vercel.app/api/v1`
- **Push workflow**: Always ask before `git push origin main` or `vercel deploy`.
