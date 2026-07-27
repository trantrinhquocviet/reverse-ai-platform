import traceback

from fastapi import FastAPI
from fastapi.responses import JSONResponse

_import_error: str | None = None

try:
    from app.main import app
except Exception:
    _import_error = traceback.format_exc()
    app = FastAPI()

if _import_error:
    @app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
    async def _catch_all(path: str = ""):
        return JSONResponse({"status": "import_error", "detail": _import_error}, status_code=500)
