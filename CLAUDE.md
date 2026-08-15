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

## AI Processing Pipeline

Processing runs **entirely client-side** in the browser via `src/contexts/ProcessingContext.tsx`. A hidden `<video>` element in `ProcessingProvider` enables background processing without requiring the user to stay on the VideoDetail page.

### Frame Sampling — 4-Stage Filter

Every candidate frame (sampled every **2 seconds**) passes through 4 stages before being sent to the AI:

```
Video frames (every 2s, starting at 3s offset)
  │
  ▼ Stage 1 — Motion Detection
  │  Pixel diff on 64×36px thumbnail vs previous frame
  │  diff < 4% → SKIP (static frame, camera not moving)
  │
  ▼ Stage 2 — Text Density (Quick OCR)
  │  Tesseract at 320px width (fast, low quality)
  │  text < 8 chars → SKIP (no labels/codes visible)
  │
  ▼ Stage 3 — Full Analysis (kept frames only)
  │  ZXing barcode/QR decode (full resolution)
  │  Tesseract OCR (full resolution) → extract tracking code patterns
  │
  ▼ Stage 4 — AI Analyze via OpenRouter
     POST /api/analyze_frame with base64 image + client-side results
     Model: nvidia/nemotron-nano-12b-v2-vl:free (env: OPEN_ROUTE)
     Saves frame to dataset_images table in Supabase
```

**Typical reduction**: ~150 candidate frames (5-min video) → ~20 frames sent to AI → ~7× fewer API calls.

**Thresholds** (in `ProcessingContext.tsx`):
- `SAMPLE_INTERVAL = 2` — seconds between candidates
- `MOTION_THRESHOLD = 0.04` — 4% pixel change required to keep frame
- `TEXT_MIN_LENGTH = 8` — minimum OCR chars to proceed to AI

### Processing Queue

- Queue state persisted in `localStorage` (`processing_queue_v1`) — survives page reload.
- `addToQueue(videos)` accepts `{ id, name, filePath }[]` — queues multiple videos.
- Auto-processes: when current job finishes, next video in queue starts automatically.
- TopBar shows live progress + queue count ("+N chờ").
- From Video Center: click **Select** → check videos → **Process (N)** → adds to queue.
- From Import URL dialog: toggle "auto add to processing queue" to queue after import.

### Why Not a Cronjob / Server Worker?

Frame extraction uses `HTMLVideoElement.currentTime` + Canvas API — requires a real browser. The `/api/analyze_frame` endpoint (AI call + DB write) runs server-side, but the frame capture step cannot. For a fully headless pipeline, a Puppeteer/Playwright worker would be needed.

---

## Deployment

- **Frontend**: Deployed to Vercel (`reverse-ai-studio/`). URL: `https://reverse-ai-platform.vercel.app`
- **Backend**: Deployed to Vercel as a Python serverless function. Entry point: `api/index.py` (project root) → `backend/app/main:app`. URL: `https://reverse-ai-platform.vercel.app/api/v1`
- **Vercel build config** (`vercel.json`): `buildCommand` = `cd reverse-ai-studio && npm install && npm run build`, `outputDirectory` = `reverse-ai-studio/dist`. Python function lives at `api/index.py`; its requirements at `api/requirements.txt` (references `../backend/requirements.txt`).
- **Push workflow**: Always ask for explicit confirmation before running `git push origin main` or `vercel deploy`. Once the user confirms ("có", "yes", "push đi", "cho phép", etc.), proceed immediately with the push — do not ask again within the same session.
