from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class TrainingStatus(str, enum.Enum):
    queued = "queued"
    running = "running"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"


class TrainingJob(Base):
    __tablename__ = "training_jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(512), nullable=False)
    dataset_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    model_architecture: Mapped[str] = mapped_column(String(255), nullable=False, default="yolov8n")
    status: Mapped[str] = mapped_column(
        Enum(TrainingStatus, name="training_status"),
        nullable=False,
        default=TrainingStatus.queued.value,
        index=True,
    )
    epochs: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    current_epoch: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    best_map50: Mapped[float | None] = mapped_column(Float, nullable=True)
    best_map95: Mapped[float | None] = mapped_column(Float, nullable=True)
    config: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    output_path: Mapped[str] = mapped_column(String(1024), nullable=False, default="")
    error_message: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
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
