from __future__ import annotations

import json
import uuid
from typing import List, Tuple

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.core.redis import enqueue_job
from app.modules.training.models import TrainingJob, TrainingStatus
from app.modules.training.schemas import TrainingJobCreate, TrainingJobUpdate

logger = structlog.get_logger(__name__)

TRAINING_QUEUE = "queue:training"


class TrainingService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_jobs(self, page: int = 1, page_size: int = 20) -> Tuple[List[TrainingJob], int]:
        # TODO: Filter by status, dataset_id, created_by
        count_result = await self.db.execute(select(func.count()).select_from(TrainingJob))
        total: int = count_result.scalar_one()
        offset = (page - 1) * page_size
        result = await self.db.execute(
            select(TrainingJob)
            .offset(offset)
            .limit(page_size)
            .order_by(TrainingJob.created_at.desc())
        )
        return list(result.scalars().all()), total

    async def get_job(self, job_id: uuid.UUID) -> TrainingJob:
        result = await self.db.execute(select(TrainingJob).where(TrainingJob.id == job_id))
        job = result.scalar_one_or_none()
        if job is None:
            raise NotFoundError(f"TrainingJob '{job_id}' not found.")
        return job

    async def create_job(
        self, data: TrainingJobCreate, created_by: uuid.UUID | None = None
    ) -> TrainingJob:
        job = TrainingJob(
            id=uuid.uuid4(),
            name=data.name,
            dataset_id=data.dataset_id,
            model_architecture=data.model_architecture,
            epochs=data.epochs,
            config=json.dumps(data.config),
            created_by=created_by,
        )
        self.db.add(job)
        await self.db.flush()

        await enqueue_job(
            TRAINING_QUEUE,
            {"job_id": str(job.id), "dataset_id": str(data.dataset_id)},
        )
        logger.info("Training job created and queued", job_id=str(job.id))
        return job

    async def update_job(self, job_id: uuid.UUID, data: TrainingJobUpdate) -> TrainingJob:
        job = await self.get_job(job_id)
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(job, field, value)
        await self.db.flush()
        return job

    async def cancel_job(self, job_id: uuid.UUID) -> TrainingJob:
        job = await self.get_job(job_id)
        # TODO: Send cancellation signal to running worker via Redis pub/sub
        job.status = TrainingStatus.cancelled.value
        await self.db.flush()
        logger.info("Training job cancelled", job_id=str(job_id))
        return job
