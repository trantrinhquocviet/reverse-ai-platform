from __future__ import annotations

import uuid
from typing import List, Tuple

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.modules.annotation.models import Annotation
from app.modules.annotation.schemas import AnnotationCreate, AnnotationUpdate

logger = structlog.get_logger(__name__)


class AnnotationService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_annotations(
        self,
        video_id: uuid.UUID | None = None,
        frame_id: uuid.UUID | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> Tuple[List[Annotation], int]:
        # TODO: Add label search, status filter, dataset_id filter
        stmt = select(Annotation)
        if video_id:
            stmt = stmt.where(Annotation.video_id == video_id)
        if frame_id:
            stmt = stmt.where(Annotation.frame_id == frame_id)

        count_result = await self.db.execute(
            select(func.count()).select_from(stmt.subquery())
        )
        total: int = count_result.scalar_one()

        offset = (page - 1) * page_size
        result = await self.db.execute(
            stmt.offset(offset).limit(page_size).order_by(Annotation.created_at.desc())
        )
        return list(result.scalars().all()), total

    async def get_annotation(self, annotation_id: uuid.UUID) -> Annotation:
        result = await self.db.execute(
            select(Annotation).where(Annotation.id == annotation_id)
        )
        annotation = result.scalar_one_or_none()
        if annotation is None:
            raise NotFoundError(f"Annotation '{annotation_id}' not found.")
        return annotation

    async def create_annotation(
        self, data: AnnotationCreate, annotated_by: uuid.UUID | None = None
    ) -> Annotation:
        annotation = Annotation(
            id=uuid.uuid4(),
            annotated_by=annotated_by,
            **data.model_dump(),
        )
        self.db.add(annotation)
        await self.db.flush()
        logger.info("Annotation created", annotation_id=str(annotation.id), label=annotation.label)
        return annotation

    async def update_annotation(
        self, annotation_id: uuid.UUID, data: AnnotationUpdate
    ) -> Annotation:
        annotation = await self.get_annotation(annotation_id)
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(annotation, field, value)
        await self.db.flush()
        return annotation

    async def delete_annotation(self, annotation_id: uuid.UUID) -> None:
        annotation = await self.get_annotation(annotation_id)
        await self.db.delete(annotation)
        await self.db.flush()
        logger.info("Annotation deleted", annotation_id=str(annotation_id))

    async def approve_annotation(self, annotation_id: uuid.UUID) -> Annotation:
        # TODO: Record reviewer ID, timestamp, notes
        annotation = await self.get_annotation(annotation_id)
        annotation.status = "approved"
        await self.db.flush()
        logger.info("Annotation approved", annotation_id=str(annotation_id))
        return annotation

    async def reject_annotation(self, annotation_id: uuid.UUID) -> Annotation:
        # TODO: Record rejection reason
        annotation = await self.get_annotation(annotation_id)
        annotation.status = "rejected"
        await self.db.flush()
        logger.info("Annotation rejected", annotation_id=str(annotation_id))
        return annotation
