from __future__ import annotations

import uuid
from typing import List, Tuple

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.modules.dataset.models import Dataset
from app.modules.dataset.schemas import DatasetCreate, DatasetUpdate

logger = structlog.get_logger(__name__)


class DatasetService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_datasets(self, page: int = 1, page_size: int = 20) -> Tuple[List[Dataset], int]:
        # TODO: Add filtering by status, search, created_by
        count_result = await self.db.execute(select(func.count()).select_from(Dataset))
        total: int = count_result.scalar_one()

        offset = (page - 1) * page_size
        result = await self.db.execute(
            select(Dataset).offset(offset).limit(page_size).order_by(Dataset.created_at.desc())
        )
        datasets = list(result.scalars().all())
        logger.debug("Listed datasets", count=len(datasets), total=total)
        return datasets, total

    async def get_dataset(self, dataset_id: uuid.UUID) -> Dataset:
        result = await self.db.execute(select(Dataset).where(Dataset.id == dataset_id))
        dataset = result.scalar_one_or_none()
        if dataset is None:
            raise NotFoundError(f"Dataset '{dataset_id}' not found.")
        return dataset

    async def create_dataset(
        self, data: DatasetCreate, created_by: uuid.UUID | None = None
    ) -> Dataset:
        # TODO: Associate videos with dataset
        dataset = Dataset(
            id=uuid.uuid4(),
            name=data.name,
            description=data.description,
            created_by=created_by,
        )
        self.db.add(dataset)
        await self.db.flush()
        logger.info("Dataset created", dataset_id=str(dataset.id), name=dataset.name)
        return dataset

    async def update_dataset(self, dataset_id: uuid.UUID, data: DatasetUpdate) -> Dataset:
        dataset = await self.get_dataset(dataset_id)
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(dataset, field, value)
        await self.db.flush()
        return dataset

    async def delete_dataset(self, dataset_id: uuid.UUID) -> None:
        dataset = await self.get_dataset(dataset_id)
        await self.db.delete(dataset)
        await self.db.flush()
        logger.info("Dataset deleted", dataset_id=str(dataset_id))
