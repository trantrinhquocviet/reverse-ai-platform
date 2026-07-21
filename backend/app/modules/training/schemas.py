from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class TrainingJobCreate(BaseModel):
    name: str = Field(min_length=1, max_length=512)
    dataset_id: uuid.UUID
    model_architecture: str = Field(default="yolov8n", max_length=255)
    epochs: int = Field(default=100, ge=1, le=1000)
    config: Dict[str, Any] = Field(default_factory=dict)


class TrainingJobOut(BaseModel):
    id: uuid.UUID
    name: str
    dataset_id: uuid.UUID
    model_architecture: str
    status: str
    epochs: int
    current_epoch: int
    best_map50: Optional[float]
    best_map95: Optional[float]
    config: str
    output_path: str
    error_message: str
    created_by: Optional[uuid.UUID]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TrainingJobUpdate(BaseModel):
    status: Optional[str] = None
    current_epoch: Optional[int] = None
    best_map50: Optional[float] = None
    best_map95: Optional[float] = None
    error_message: Optional[str] = None
