from __future__ import annotations

import uuid
from typing import List, Tuple

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.core.redis import enqueue_job
from app.modules.inspector.models import InspectionResult, InspectionStatus
from app.modules.inspector.schemas import InspectionCreate

logger = structlog.get_logger(__name__)

INFERENCE_QUEUE = "queue:inference"


class InspectorService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_inspections(
        self, video_id: uuid.UUID | None = None, page: int = 1, page_size: int = 20
    ) -> Tuple[List[InspectionResult], int]:
        stmt = select(InspectionResult)
        if video_id:
            stmt = stmt.where(InspectionResult.video_id == video_id)
        count_result = await self.db.execute(
            select(func.count()).select_from(stmt.subquery())
        )
        total: int = count_result.scalar_one()
        offset = (page - 1) * page_size
        result = await self.db.execute(
            stmt.offset(offset).limit(page_size).order_by(InspectionResult.created_at.desc())
        )
        return list(result.scalars().all()), total

    async def get_inspection(self, inspection_id: uuid.UUID) -> InspectionResult:
        result = await self.db.execute(
            select(InspectionResult).where(InspectionResult.id == inspection_id)
        )
        record = result.scalar_one_or_none()
        if record is None:
            raise NotFoundError(f"Inspection '{inspection_id}' not found.")
        return record

    async def trigger_inspection(
        self, data: InspectionCreate, triggered_by: uuid.UUID | None = None
    ) -> InspectionResult:
        inspection = InspectionResult(
            id=uuid.uuid4(),
            video_id=data.video_id,
            model_id=data.model_id,
            triggered_by=triggered_by,
        )
        self.db.add(inspection)
        await self.db.flush()

        await enqueue_job(
            INFERENCE_QUEUE,
            {
                "inspection_id": str(inspection.id),
                "video_id": str(data.video_id),
                "model_id": str(data.model_id) if data.model_id else None,
            },
        )
        logger.info("Inspection triggered", inspection_id=str(inspection.id))
        return inspection
