from fastapi import FastAPI
from fastapi.responses import JSONResponse

# Defined at top level so Vercel static analysis finds it
app = FastAPI()

_import_error: str | None = None

try:
    from app.main import app as _app  # type: ignore[assignment]
    app = _app
except Exception:
    import traceback
    _import_error = traceback.format_exc()


@app.get("/_debug")
async def debug():
    return {"import_error": _import_error, "ok": _import_error is None}
