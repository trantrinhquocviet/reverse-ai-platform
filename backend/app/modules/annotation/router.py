from __future__ import annotations

import base64
import io
import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies import CurrentUser, get_current_user
from app.modules.annotation.schemas import AnnotationCreate, AnnotationOut, AnnotationUpdate, OcrRequest, OcrResponse
from app.modules.annotation.service import AnnotationService
from app.schemas.common import PaginatedResponse, SuccessResponse

router = APIRouter(prefix="/annotations", tags=["Annotations"])


def _run_tesseract(image_bytes: bytes) -> list[str]:
    import pytesseract  # noqa: PLC0415
    from PIL import Image  # noqa: PLC0415

    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    # Upscale small images for better accuracy
    if img.width < 800:
        ratio = 800 / img.width
        img = img.resize((800, int(img.height * ratio)), Image.LANCZOS)

    text = pytesseract.image_to_string(img, lang="vie+eng", config="--psm 6")
    lines = [ln.strip() for ln in text.splitlines() if len(ln.strip()) >= 2]
    return lines


@router.post("/ocr", response_model=OcrResponse)
async def run_ocr(
    body: OcrRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> OcrResponse:
    import asyncio  # noqa: PLC0415

    if not body.image_url and not body.image_base64:
        raise HTTPException(status_code=422, detail="Provide image_url or image_base64")

    if body.image_base64:
        image_bytes = base64.b64decode(body.image_base64)
    else:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(body.image_url)  # type: ignore[arg-type]
        resp.raise_for_status()
        image_bytes = resp.content

    # Run in thread pool to avoid blocking event loop
    loop = asyncio.get_event_loop()
    lines = await loop.run_in_executor(None, _run_tesseract, image_bytes)
    return OcrResponse(text="\n".join(lines), lines=lines)


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
