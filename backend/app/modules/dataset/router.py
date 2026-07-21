from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies import CurrentUser, get_current_user
from app.modules.dataset.schemas import DatasetCreate, DatasetOut, DatasetUpdate
from app.modules.dataset.service import DatasetService
from app.schemas.common import PaginatedResponse, SuccessResponse

router = APIRouter(prefix="/datasets", tags=["Datasets"])


@router.get("", response_model=PaginatedResponse[DatasetOut])
async def list_datasets(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> PaginatedResponse[DatasetOut]:
    service = DatasetService(db)
    datasets, total = await service.list_datasets(page=page, page_size=page_size)
    items = [DatasetOut.model_validate(d) for d in datasets]
    return PaginatedResponse.create(items=items, total=total, page=page, page_size=page_size)


@router.get("/{dataset_id}", response_model=DatasetOut)
async def get_dataset(
    dataset_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> DatasetOut:
    service = DatasetService(db)
    dataset = await service.get_dataset(dataset_id)
    return DatasetOut.model_validate(dataset)


@router.post("", response_model=DatasetOut, status_code=201)
async def create_dataset(
    body: DatasetCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> DatasetOut:
    service = DatasetService(db)
    dataset = await service.create_dataset(body, created_by=uuid.UUID(current_user.user_id))
    return DatasetOut.model_validate(dataset)


@router.patch("/{dataset_id}", response_model=DatasetOut)
async def update_dataset(
    dataset_id: uuid.UUID,
    body: DatasetUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> DatasetOut:
    service = DatasetService(db)
    dataset = await service.update_dataset(dataset_id, body)
    return DatasetOut.model_validate(dataset)


@router.delete("/{dataset_id}", response_model=SuccessResponse)
async def delete_dataset(
    dataset_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> SuccessResponse:
    service = DatasetService(db)
    await service.delete_dataset(dataset_id)
    return SuccessResponse(message="Dataset deleted.")
