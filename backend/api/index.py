import traceback

try:
    from app.main import app
except Exception as e:
    from fastapi import FastAPI
    app = FastAPI()

    _error = traceback.format_exc()

    @app.get("/health")
    async def health():
        return {"status": "import_error", "detail": _error}

    @app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
    async def catch_all(path: str):
        return {"status": "import_error", "detail": _error}
