from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class InspectionStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


class InspectionResult(Base):
    __tablename__ = "inspection_results"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    video_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    model_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    status: Mapped[str] = mapped_column(
        Enum(InspectionStatus, name="inspection_status"),
        nullable=False,
        default=InspectionStatus.pending.value,
        index=True,
    )
    defect_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    confidence_avg: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    frames_processed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    result_payload: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    error_message: Mapped[str] = mapped_column(Text, nullable=False, default="")
    triggered_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
