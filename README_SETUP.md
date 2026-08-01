# Reverse AI Studio — Supabase Setup Guide

Follow these steps in order after cloning the repo.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.11+ |
| pip | latest |
| psql (optional) | for manual inspection |

---

## Step 1 — Install Python dependencies

```bash
cd backend
pip install -r requirements.txt
# Also install Alembic + async drivers if not already in requirements.txt
pip install alembic asyncpg psycopg2-binary python-dotenv requests
```

---

## Step 2 — Verify backend/.env

The file `backend/.env` has already been created with the correct values.
Double-check the DATABASE_URL uses the URL-encoded password:

```
DATABASE_URL=postgresql+asyncpg://postgres:%5Bwf6Ker3%2BRHP%2AhR%26%5D@db.eofvdrskqtwctwbhkfda.supabase.co:5432/postgres
```

> The raw password `[wf6Ker3+RHP*hR&]` is encoded as `%5Bwf6Ker3%2BRHP%2AhR%26%5D`.

---

## Step 3 — Run database migrations

This creates all 25 tables in Supabase Postgres.

```bash
cd backend
alembic upgrade head
```

To check the current revision:

```bash
alembic current
```

To roll back:

```bash
alembic downgrade -1   # one step back
alembic downgrade base  # all the way back (drops every table)
```

---

## Step 4 — Create Supabase Storage buckets

```bash
cd backend
python scripts/setup_supabase.py
```

This creates the following buckets via the Supabase Storage API:

| Bucket | Public |
|--------|--------|
| videos | No |
| frames | No |
| thumbnails | Yes |
| models | No |
| exports | No |

---

## Step 5 — Seed initial data

```bash
cd backend
python scripts/seed_data.py
```

Inserts:
- Admin user: `admin@reverse-ai.com` / `admin123`
- Warehouses: Warehouse A, B, C
- Brands: Brand X, Y, Z

> Safe to run multiple times — rows that already exist are skipped.

---

## Step 6 — Start the backend

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs available at: http://localhost:8000/docs

---

## File reference

| File | Purpose |
|------|---------|
| `backend/alembic.ini` | Alembic config; points at Supabase with encoded password |
| `backend/migrations/env.py` | Alembic env; imports all models, uses async engine |
| `backend/migrations/versions/001_initial.py` | Full hand-written initial migration (25 tables) |
| `backend/app/config.py` | Pydantic settings; adds `ASYNC_DATABASE_URL` and `DATABASE_URL_ENCODED` |
| `backend/app/core/database.py` | SQLAlchemy async engine (uses `ASYNC_DATABASE_URL`) |
| `backend/scripts/setup_supabase.py` | Creates Storage buckets via REST API |
| `backend/scripts/seed_data.py` | Seeds admin user, warehouses, brands |
| `backend/.env` | Backend-specific environment variables |

---

## Troubleshooting

### "password authentication failed"
Make sure you are using the URL-encoded password in `DATABASE_URL`. The characters `[`, `+`, `*`, `&`, `]` must be percent-encoded.

### "asyncpg: ... SSL connection has been closed"
Supabase requires SSL. asyncpg uses SSL by default — no extra config needed.

### Alembic ImportError on `app.modules.*`
Run alembic from the `backend/` directory so Python can find the `app` package:
```bash
cd backend
alembic upgrade head
```

### Storage bucket creation fails with 401
Check that `SUPABASE_SERVICE_ROLE_KEY` in `backend/.env` is correct (starts with `sb_secret_`).
