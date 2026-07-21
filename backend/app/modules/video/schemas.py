from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class VideoCreate(BaseModel):
    name: str = Field(min_length=1, max_length=512)
    warehouse: str = Field(default="", max_length=255)
    brand: str = Field(default="", max_length=255)
    resolution: str = Field(default="", max_length=64)


class VideoUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=512)
    warehouse: Optional[str] = Field(default=None, max_length=255)
    brand: Optional[str] = Field(default=None, max_length=255)
    status: Optional[str] = None


class VideoOut(BaseModel):
    id: uuid.UUID
    name: str
    warehouse: str
    brand: str
    duration: Optional[float]
    resolution: str
    status: str
    file_path: str
    thumbnail_path: str
    uploaded_by: Optional[uuid.UUID]
    frame_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class VideoFilter(BaseModel):
    status: Optional[str] = None
    warehouse: Optional[str] = None
    brand: Optional[str] = None
    search: Optional[str] = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)


class VideoUploadResponse(BaseModel):
    video_id: uuid.UUID
    job_id: str
    message: str
