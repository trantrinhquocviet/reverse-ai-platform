from __future__ import annotations

import uuid
from typing import List, Tuple

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.core.redis import enqueue_job
from app.modules.video.models import Video, VideoStatus
from app.modules.video.schemas import VideoCreate, VideoFilter, VideoOut, VideoUpdate

logger = structlog.get_logger(__name__)

FRAME_QUEUE = "queue:frame_extraction"


class VideoService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_videos(self, filters: VideoFilter) -> Tuple[List[Video], int]:
        """Return a paginated list of videos matching the given filters."""
        stmt = select(Video)

        if filters.status:
            stmt = stmt.where(Video.status == filters.status)
        if filters.warehouse:
            stmt = stmt.where(Video.warehouse == filters.warehouse)
        if filters.brand:
            stmt = stmt.where(Video.brand == filters.brand)
        if filters.search:
            stmt = stmt.where(Video.name.ilike(f"%{filters.search}%"))

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_result = await self.db.execute(count_stmt)
        total: int = total_result.scalar_one()

        offset = (filters.page - 1) * filters.page_size
        stmt = stmt.offset(offset).limit(filters.page_size).order_by(Video.created_at.desc())
        result = await self.db.execute(stmt)
        videos = list(result.scalars().all())

        logger.debug("Listed videos", count=len(videos), total=total, filters=filters.model_dump())
        return videos, total

    async def get_video(self, video_id: uuid.UUID) -> Video:
        result = await self.db.execute(select(Video).where(Video.id == video_id))
        video = result.scalar_one_or_none()
        if video is None:
            raise NotFoundError(f"Video '{video_id}' not found.")
        return video

    async def create_video(self, data: VideoCreate, uploaded_by: uuid.UUID | None = None) -> Video:
        video = Video(
            id=uuid.uuid4(),
            name=data.name,
            warehouse=data.warehouse,
            brand=data.brand,
            resolution=data.resolution,
            uploaded_by=uploaded_by,
            status=VideoStatus.pending.value,
        )
        self.db.add(video)
        await self.db.flush()
        logger.info("Video record created", video_id=str(video.id), name=video.name)
        return video

    async def update_video(self, video_id: uuid.UUID, data: VideoUpdate) -> Video:
        video = await self.get_video(video_id)
        update_data = data.model_dump(exclude_none=True)
        for field, value in update_data.items():
            setattr(video, field, value)
        await self.db.flush()
        logger.info("Video updated", video_id=str(video_id), fields=list(update_data.keys()))
        return video

    async def delete_video(self, video_id: uuid.UUID) -> None:
        video = await self.get_video(video_id)
        await self.db.delete(video)
        await self.db.flush()
        logger.info("Video deleted", video_id=str(video_id))

    async def enqueue_frame_extraction(self, video_id: uuid.UUID, file_path: str) -> str:
        """Queue a frame-extraction job and mark video as processing."""
        video = await self.get_video(video_id)
        video.status = VideoStatus.processing.value
        await self.db.flush()

        job_id = await enqueue_job(
            FRAME_QUEUE,
            {"video_id": str(video_id), "file_path": file_path},
        )
        logger.info("Frame extraction enqueued", video_id=str(video_id), job_id=job_id)
        return job_id
