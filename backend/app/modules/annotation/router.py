from __future__ import annotations

import base64
import io
import json
import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.database import get_db
from app.dependencies import CurrentUser, get_current_user
from app.modules.annotation.schemas import AnnotationCreate, AnnotationOut, AnnotationUpdate, OcrRequest, OcrResponse
from app.modules.annotation.service import AnnotationService
from app.schemas.common import PaginatedResponse, SuccessResponse

router = APIRouter(prefix="/annotations", tags=["Annotations"])


async def _ocr_google_vision(image_b64: str) -> list[str]:
    api_key = settings.GOOGLE_VISION_API_KEY
    if not api_key:
        raise HTTPException(status_code=503, detail="Google Vision API key not configured")

    payload = {
        "requests": [{
            "image": {"content": image_b64},
            "features": [{"type": "TEXT_DETECTION", "maxResults": 1}],
            "imageContext": {"languageHints": ["vi", "en"]},
        }]
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"https://vision.googleapis.com/v1/images:annotate?key={api_key}",
            content=json.dumps(payload),
            headers={"Content-Type": "application/json"},
        )
    resp.raise_for_status()
    data = resp.json()

    try:
        full_text: str = data["responses"][0]["fullTextAnnotation"]["text"]
        lines = [ln.strip() for ln in full_text.splitlines() if len(ln.strip()) >= 2]
        return lines
    except (KeyError, IndexError):
        return []


@router.post("/ocr", response_model=OcrResponse)
async def run_ocr(
    body: OcrRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> OcrResponse:
    if not body.image_url and not body.image_base64:
        raise HTTPException(status_code=422, detail="Provide image_url or image_base64")

    if body.image_base64:
        image_b64 = body.image_base64
    else:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(body.image_url)  # type: ignore[arg-type]
        resp.raise_for_status()
        image_b64 = base64.b64encode(resp.content).decode()

    lines = await _ocr_google_vision(image_b64)
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
