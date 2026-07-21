from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies import CurrentUser, get_current_user
from app.modules.training.schemas import TrainingJobCreate, TrainingJobOut, TrainingJobUpdate
from app.modules.training.service import TrainingService
from app.schemas.common import PaginatedResponse, SuccessResponse

router = APIRouter(prefix="/training", tags=["Training"])


@router.get("", response_model=PaginatedResponse[TrainingJobOut])
async def list_jobs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> PaginatedResponse[TrainingJobOut]:
    service = TrainingService(db)
    jobs, total = await service.list_jobs(page=page, page_size=page_size)
    items = [TrainingJobOut.model_validate(j) for j in jobs]
    return PaginatedResponse.create(items=items, total=total, page=page, page_size=page_size)


@router.get("/{job_id}", response_model=TrainingJobOut)
async def get_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> TrainingJobOut:
    service = TrainingService(db)
    return TrainingJobOut.model_validate(await service.get_job(job_id))


@router.post("", response_model=TrainingJobOut, status_code=202)
async def create_job(
    body: TrainingJobCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> TrainingJobOut:
    service = TrainingService(db)
    job = await service.create_job(body, created_by=uuid.UUID(current_user.user_id))
    return TrainingJobOut.model_validate(job)


@router.patch("/{job_id}", response_model=TrainingJobOut)
async def update_job(
    job_id: uuid.UUID,
    body: TrainingJobUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> TrainingJobOut:
    service = TrainingService(db)
    return TrainingJobOut.model_validate(await service.update_job(job_id, body))


@router.post("/{job_id}/cancel", response_model=TrainingJobOut)
async def cancel_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> TrainingJobOut:
    service = TrainingService(db)
    return TrainingJobOut.model_validate(await service.cancel_job(job_id))
