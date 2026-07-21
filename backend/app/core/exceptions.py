from __future__ import annotations

from typing import Any

import structlog
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.status import (
    HTTP_400_BAD_REQUEST,
    HTTP_401_UNAUTHORIZED,
    HTTP_403_FORBIDDEN,
    HTTP_404_NOT_FOUND,
    HTTP_409_CONFLICT,
    HTTP_422_UNPROCESSABLE_ENTITY,
    HTTP_500_INTERNAL_SERVER_ERROR,
)

logger = structlog.get_logger(__name__)


class AppError(Exception):
    """Base application error."""

    status_code: int = HTTP_500_INTERNAL_SERVER_ERROR
    error_code: str = "INTERNAL_ERROR"

    def __init__(self, message: str, detail: Any = None) -> None:
        self.message = message
        self.detail = detail
        super().__init__(message)

    def to_dict(self, request_id: str = "") -> dict[str, Any]:
        return {
            "status": "error",
            "message": self.message,
            "error_code": self.error_code,
            "request_id": request_id,
            "detail": self.detail,
        }


class NotFoundError(AppError):
    status_code = HTTP_404_NOT_FOUND
    error_code = "NOT_FOUND"


class UnauthorizedError(AppError):
    status_code = HTTP_401_UNAUTHORIZED
    error_code = "UNAUTHORIZED"


class ForbiddenError(AppError):
    status_code = HTTP_403_FORBIDDEN
    error_code = "FORBIDDEN"


class ValidationError(AppError):
    status_code = HTTP_422_UNPROCESSABLE_ENTITY
    error_code = "VALIDATION_ERROR"


class ConflictError(AppError):
    status_code = HTTP_409_CONFLICT
    error_code = "CONFLICT"


class BadRequestError(AppError):
    status_code = HTTP_400_BAD_REQUEST
    error_code = "BAD_REQUEST"


def _get_request_id(request: Request) -> str:
    return getattr(request.state, "request_id", "")


def register_exception_handlers(app: FastAPI) -> None:
    """Attach all global exception handlers to the FastAPI app."""

    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
        request_id = _get_request_id(request)
        logger.warning(
            "Application error",
            error_code=exc.error_code,
            message=exc.message,
            status_code=exc.status_code,
            request_id=request_id,
        )
        return JSONResponse(
            status_code=exc.status_code,
            content=exc.to_dict(request_id=request_id),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        request_id = _get_request_id(request)
        logger.exception(
            "Unhandled exception",
            request_id=request_id,
            exc_info=exc,
        )
        return JSONResponse(
            status_code=HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": "error",
                "message": "An unexpected error occurred.",
                "error_code": "INTERNAL_ERROR",
                "request_id": request_id,
                "detail": None,
            },
        )
