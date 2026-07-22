from __future__ import annotations

import uuid

import structlog
from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies import CurrentUser, get_current_user
from app.modules.video.schemas import (
    VideoCreate,
    VideoFilter,
    VideoImportUrl,
    VideoOut,
    VideoUpdate,
    VideoUploadResponse,
)
from app.modules.video.service import VideoService
from app.schemas.common import PaginatedResponse, SuccessResponse

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/videos", tags=["Videos"])


@router.get("", response_model=PaginatedResponse[VideoOut], summary="List videos with filters")
async def list_videos(
    status: str | None = Query(default=None),
    warehouse: str | None = Query(default=None),
    brand: str | None = Query(default=None),
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> PaginatedResponse[VideoOut]:
    service = VideoService(db)
    filters = VideoFilter(
        status=status,
        warehouse=warehouse,
        brand=brand,
        search=search,
        page=page,
        page_size=page_size,
    )
    videos, total = await service.list_videos(filters)
    items = [VideoOut.model_validate(v) for v in videos]
    return PaginatedResponse.create(items=items, total=total, page=page, page_size=page_size)


@router.get("/{video_id}", response_model=VideoOut, summary="Get video by ID")
async def get_video(
    video_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> VideoOut:
    service = VideoService(db)
    video = await service.get_video(video_id)
    return VideoOut.model_validate(video)


@router.post("", response_model=VideoOut, status_code=201, summary="Create video metadata")
async def create_video(
    body: VideoCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> VideoOut:
    service = VideoService(db)
    video = await service.create_video(body, uploaded_by=uuid.UUID(current_user.user_id))
    return VideoOut.model_validate(video)


@router.patch("/{video_id}", response_model=VideoOut, summary="Update video metadata")
async def update_video(
    video_id: uuid.UUID,
    body: VideoUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> VideoOut:
    service = VideoService(db)
    video = await service.update_video(video_id, body)
    return VideoOut.model_validate(video)


@router.delete("/{video_id}", response_model=SuccessResponse, summary="Delete video")
async def delete_video(
    video_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> SuccessResponse:
    service = VideoService(db)
    await service.delete_video(video_id)
    return SuccessResponse(message="Video deleted successfully.")


@router.post(
    "/import-url",
    response_model=VideoUploadResponse,
    status_code=202,
    summary="Import a video from a remote URL — system downloads it automatically",
)
async def import_video_from_url(
    body: VideoImportUrl,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> VideoUploadResponse:
    service = VideoService(db)
    video, job_id = await service.import_video_from_url(
        body, uploaded_by=uuid.UUID(current_user.user_id)
    )
    logger.info("Video imported from URL", video_id=str(video.id), url=body.url, job_id=job_id)
    return VideoUploadResponse(
        video_id=video.id,
        job_id=job_id,
        message="Video URL received, downloading and queued for frame extraction.",
    )


@router.post(
    "/upload",
    response_model=VideoUploadResponse,
    status_code=202,
    summary="Upload a video file and enqueue frame extraction",
)
async def upload_video(
    file: UploadFile = File(...),
    warehouse: str = Query(default=""),
    brand: str = Query(default=""),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> VideoUploadResponse:
    # In production: stream file to Supabase Storage, get back a signed URL / path.
    # Here we simulate a file path.
    simulated_path = f"uploads/{uuid.uuid4()}/{file.filename}"

    service = VideoService(db)
    video = await service.create_video(
        VideoCreate(name=file.filename or "untitled", warehouse=warehouse, brand=brand),
        uploaded_by=uuid.UUID(current_user.user_id),
    )
    video.file_path = simulated_path

    job_id = await service.enqueue_frame_extraction(video.id, simulated_path)

    logger.info(
        "Video uploaded",
        video_id=str(video.id),
        filename=file.filename,
        job_id=job_id,
    )

    return VideoUploadResponse(
        video_id=video.id,
        job_id=job_id,
        message="Video uploaded and queued for frame extraction.",
    )
