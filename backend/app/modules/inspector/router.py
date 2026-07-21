from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies import CurrentUser, get_current_user
from app.modules.inspector.schemas import InspectionCreate, InspectionOut
from app.modules.inspector.service import InspectorService
from app.schemas.common import PaginatedResponse

router = APIRouter(prefix="/inspector", tags=["Inspector"])


@router.get("", response_model=PaginatedResponse[InspectionOut])
async def list_inspections(
    video_id: uuid.UUID | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> PaginatedResponse[InspectionOut]:
    service = InspectorService(db)
    records, total = await service.list_inspections(
        video_id=video_id, page=page, page_size=page_size
    )
    items = [InspectionOut.model_validate(r) for r in records]
    return PaginatedResponse.create(items=items, total=total, page=page, page_size=page_size)


@router.get("/{inspection_id}", response_model=InspectionOut)
async def get_inspection(
    inspection_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> InspectionOut:
    service = InspectorService(db)
    return InspectionOut.model_validate(await service.get_inspection(inspection_id))


@router.post("", response_model=InspectionOut, status_code=202)
async def trigger_inspection(
    body: InspectionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> InspectionOut:
    service = InspectorService(db)
    inspection = await service.trigger_inspection(
        body, triggered_by=uuid.UUID(current_user.user_id)
    )
    return InspectionOut.model_validate(inspection)
