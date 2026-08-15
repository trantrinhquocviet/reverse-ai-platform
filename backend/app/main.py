from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import AsyncGenerator

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.core.database import connect_db, disconnect_db
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging
from app.core.middleware import LoggingMiddleware, RateLimitMiddleware, RequestIDMiddleware
from app.core.redis import close_redis_pool, get_redis_pool
import sys as _sys
import traceback as _traceback

_ai_analysis_error: str = ""
try:
    from app.modules.ai_analysis.router import router as ai_analysis_router
    _ai_analysis_ok = True
except Exception as _e:
    ai_analysis_router = None  # type: ignore
    _ai_analysis_ok = False
    _ai_analysis_error = _traceback.format_exc()
    print(f"[ERROR] ai_analysis router failed to load:\n{_ai_analysis_error}", file=_sys.stderr)
from app.modules.analytics.router import router as analytics_router
from app.modules.annotation.router import router as annotation_router
from app.modules.auth.router import router as auth_router
from app.modules.dataset.router import router as dataset_router
from app.modules.inspector.router import router as inspector_router
from app.modules.integration.router import router as integration_router
from app.modules.training.router import router as training_router
from app.modules.video.router import router as video_router

configure_logging(debug=settings.DEBUG)

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup and shutdown lifecycle hooks."""
    logger.info(
        "Starting up Reverse AI Studio API",
        version=settings.APP_VERSION,
        debug=settings.DEBUG,
    )
    await connect_db()
    try:
        await get_redis_pool()
        logger.info("Database and Redis connections established.")
    except Exception as e:
        logger.warning("Redis unavailable — background jobs disabled.", error=str(e))

    yield

    logger.info("Shutting down Reverse AI Studio API")
    await disconnect_db()
    await close_redis_pool()
    logger.info("Database and Redis connections closed.")


app = FastAPI(
    title="Reverse AI Studio API",
    version=settings.APP_VERSION,
    description=(
        "Backend API for Reverse AI Studio — "
        "an end-to-end platform for video-based AI model training and quality inspection."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# ── Middleware (order matters: outermost wraps are applied last) ──────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RateLimitMiddleware, max_requests=200, window_seconds=60)
app.add_middleware(LoggingMiddleware)
app.add_middleware(RequestIDMiddleware)

# ── Global exception handlers ─────────────────────────────────────────────────
register_exception_handlers(app)

# ── Routers ───────────────────────────────────────────────────────────────────
API_PREFIX = "/api/v1"

if _ai_analysis_ok and ai_analysis_router is not None:
    app.include_router(ai_analysis_router)
app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(video_router, prefix=API_PREFIX)
app.include_router(dataset_router, prefix=API_PREFIX)
app.include_router(annotation_router, prefix=API_PREFIX)
app.include_router(training_router, prefix=API_PREFIX)
app.include_router(inspector_router, prefix=API_PREFIX)
app.include_router(analytics_router, prefix=API_PREFIX)
app.include_router(integration_router, prefix=API_PREFIX)


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"], summary="Health check")
async def health_check() -> dict:
    return {
        "status": "ok",
        "version": settings.APP_VERSION,
        "timestamp": datetime.now(tz=timezone.utc).isoformat(),
        "ai_analysis_loaded": _ai_analysis_ok,
        "ai_analysis_error": _ai_analysis_error if not _ai_analysis_ok else None,
    }


@app.get("/debug/router", tags=["Debug"])
async def debug_router() -> dict:
    return {
        "ai_analysis_loaded": _ai_analysis_ok,
        "ai_analysis_error": _ai_analysis_error if not _ai_analysis_ok else None,
    }


# ── Static frontend (must be mounted last) ────────────────────────────────────
_STATIC_DIR = Path(__file__).parent.parent / "static"

if _STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=_STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str) -> FileResponse:
        return FileResponse(_STATIC_DIR / "index.html")
