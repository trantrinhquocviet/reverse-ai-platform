from __future__ import annotations

import mimetypes
import uuid

import httpx
import structlog
from fastapi import UploadFile

from app.config import settings

logger = structlog.get_logger(__name__)

_CHUNK_SIZE = 1024 * 1024  # 1 MB


def _storage_base() -> str:
    return f"{settings.SUPABASE_URL}/storage/v1/object"


def _auth_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}"}


def public_url(storage_path: str) -> str:
    """Return the public URL for a file already uploaded to Supabase Storage."""
    bucket = settings.SUPABASE_STORAGE_BUCKET
    return f"{settings.SUPABASE_URL}/storage/v1/object/public/{bucket}/{storage_path}"


async def upload_file(upload: UploadFile, video_id: uuid.UUID) -> str:
    """Stream an UploadFile to Supabase Storage and return the storage path."""
    filename = upload.filename or "video"
    storage_path = f"{video_id}/{filename}"
    bucket = settings.SUPABASE_STORAGE_BUCKET
    content_type = upload.content_type or mimetypes.guess_type(filename)[0] or "video/mp4"

    url = f"{_storage_base()}/{bucket}/{storage_path}"
    headers = {**_auth_headers(), "Content-Type": content_type}

    async with httpx.AsyncClient(timeout=600) as client:
        # Read entire file into memory then upload; for large files a chunked
        # transfer would need multipart — Supabase Storage supports single PUT.
        content = await upload.read()
        resp = await client.put(url, content=content, headers=headers)
        if resp.status_code not in (200, 201):
            raise RuntimeError(
                f"Supabase Storage upload failed [{resp.status_code}]: {resp.text}"
            )

    logger.info("File uploaded to Supabase Storage", path=storage_path, bytes=len(content))
    return storage_path


async def upload_bytes(content: bytes, filename: str, video_id: uuid.UUID) -> str:
    """Upload raw bytes (e.g. downloaded from URL) to Supabase Storage."""
    storage_path = f"{video_id}/{filename}"
    bucket = settings.SUPABASE_STORAGE_BUCKET
    content_type = mimetypes.guess_type(filename)[0] or "video/mp4"

    url = f"{_storage_base()}/{bucket}/{storage_path}"
    headers = {**_auth_headers(), "Content-Type": content_type}

    async with httpx.AsyncClient(timeout=600) as client:
        resp = await client.put(url, content=content, headers=headers)
        if resp.status_code not in (200, 201):
            raise RuntimeError(
                f"Supabase Storage upload failed [{resp.status_code}]: {resp.text}"
            )

    logger.info("Bytes uploaded to Supabase Storage", path=storage_path, bytes=len(content))
    return storage_path
