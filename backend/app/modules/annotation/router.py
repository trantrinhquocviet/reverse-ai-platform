from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies import CurrentUser, get_current_user
from app.modules.annotation.schemas import AnnotationCreate, AnnotationOut, AnnotationUpdate
from app.modules.annotation.service import AnnotationService
from app.schemas.common import PaginatedResponse, SuccessResponse

router = APIRouter(prefix="/annotations", tags=["Annotations"])


@router.get("", response_model=PaginatedResponse[AnnotationOut])
async def list_annotations(
    video_id: uuid.UUID | None = Query(default=None),
    frame_id: uuid.UUID | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> PaginatedResponse[AnnotationOut]:
    service = AnnotationService(db)
    annotations, total = await service.list_annotations(
        video_id=video_id, frame_id=frame_id, page=page, page_size=page_size
    )
    items = [AnnotationOut.model_validate(a) for a in annotations]
    return PaginatedResponse.create(items=items, total=total, page=page, page_size=page_size)


@router.get("/{annotation_id}", response_model=AnnotationOut)
async def get_annotation(
    annotation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> AnnotationOut:
    service = AnnotationService(db)
    return AnnotationOut.model_validate(await service.get_annotation(annotation_id))


@router.post("", response_model=AnnotationOut, status_code=201)
async def create_annotation(
    body: AnnotationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> AnnotationOut:
    service = AnnotationService(db)
    annotation = await service.create_annotation(
        body, annotated_by=uuid.UUID(current_user.user_id)
    )
    return AnnotationOut.model_validate(annotation)


@router.patch("/{annotation_id}", response_model=AnnotationOut)
async def update_annotation(
    annotation_id: uuid.UUID,
    body: AnnotationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> AnnotationOut:
    service = AnnotationService(db)
    return AnnotationOut.model_validate(await service.update_annotation(annotation_id, body))


@router.post("/{annotation_id}/approve", response_model=AnnotationOut)
async def approve_annotation(
    annotation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> AnnotationOut:
    service = AnnotationService(db)
    return AnnotationOut.model_validate(await service.approve_annotation(annotation_id))


@router.post("/{annotation_id}/reject", response_model=AnnotationOut)
async def reject_annotation(
    annotation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> AnnotationOut:
    service = AnnotationService(db)
    return AnnotationOut.model_validate(await service.reject_annotation(annotation_id))


@router.delete("/{annotation_id}", response_model=SuccessResponse)
async def delete_annotation(
    annotation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> SuccessResponse:
    service = AnnotationService(db)
    await service.delete_annotation(annotation_id)
    return SuccessResponse(message="Annotation deleted.")
