from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class AnnotationCreate(BaseModel):
    frame_id: uuid.UUID
    video_id: uuid.UUID
    dataset_id: Optional[uuid.UUID] = None
    annotation_type: str = "bounding_box"
    label: str = Field(min_length=1, max_length=255)
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    x: float = Field(default=0.0, ge=0.0, le=1.0)
    y: float = Field(default=0.0, ge=0.0, le=1.0)
    width: float = Field(default=0.0, ge=0.0, le=1.0)
    height: float = Field(default=0.0, ge=0.0, le=1.0)


class AnnotationUpdate(BaseModel):
    label: Optional[str] = Field(default=None, min_length=1, max_length=255)
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    status: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None


class AnnotationOut(BaseModel):
    id: uuid.UUID
    frame_id: uuid.UUID
    video_id: uuid.UUID
    dataset_id: Optional[uuid.UUID]
    annotation_type: str
    label: str
    confidence: float
    status: str
    x: float
    y: float
    width: float
    height: float
    annotated_by: Optional[uuid.UUID]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
