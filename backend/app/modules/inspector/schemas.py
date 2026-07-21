from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class InspectionCreate(BaseModel):
    video_id: uuid.UUID
    model_id: Optional[uuid.UUID] = None


class InspectionOut(BaseModel):
    id: uuid.UUID
    video_id: uuid.UUID
    model_id: Optional[uuid.UUID]
    status: str
    defect_count: int
    confidence_avg: float
    frames_processed: int
    result_payload: str
    error_message: str
    triggered_by: Optional[uuid.UUID]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
