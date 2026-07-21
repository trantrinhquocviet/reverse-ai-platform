from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class DatasetCreate(BaseModel):
    name: str = Field(min_length=1, max_length=512)
    description: str = Field(default="")


class DatasetUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=512)
    description: Optional[str] = None
    status: Optional[str] = None


class DatasetOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str
    status: str
    video_count: int
    frame_count: int
    annotation_count: int
    created_by: Optional[uuid.UUID]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
