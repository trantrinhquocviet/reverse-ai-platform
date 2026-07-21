from __future__ import annotations

from typing import Any, Generic, List, Optional, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    """Standard paginated list response."""

    items: List[T]
    total: int
    page: int
    page_size: int
    pages: int

    model_config = {"arbitrary_types_allowed": True}

    @classmethod
    def create(
        cls,
        items: List[T],
        total: int,
        page: int,
        page_size: int,
    ) -> "PaginatedResponse[T]":
        pages = max(1, (total + page_size - 1) // page_size)
        return cls(items=items, total=total, page=page, page_size=page_size, pages=pages)


class ErrorResponse(BaseModel):
    """Standard error envelope."""

    status: str = "error"
    message: str
    error_code: str
    request_id: str = ""
    detail: Optional[Any] = None


class SuccessResponse(BaseModel):
    """Standard success envelope for non-list responses."""

    status: str = "ok"
    message: str = "Success"
    data: Optional[Any] = None
    request_id: str = Field(default="")
