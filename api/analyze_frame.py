import base64
import json
import os
import uuid
from datetime import datetime, timezone

import httpx
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OPENROUTER_API_KEY = os.environ.get("OPEN_ROUTE", "")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

OPENROUTER_MODEL = "google/gemini-2.5-flash:free"

VISION_PROMPT = """You are analyzing a warehouse packing video frame. Detect and extract:
1. Tracking codes / order codes (e.g. TTK3CE-584361784077026534)
2. Any visible text on labels or packages (OCR)
3. Packaging status: "ok", "damaged", or "unknown"
4. Number of packages visible in frame (integer)
5. Notes about anything unusual

Return ONLY valid JSON (no markdown, no code fences):
{
  "tracking_codes": ["string"],
  "barcodes": [],
  "packaging_status": "ok|damaged|unknown",
  "package_count": 0,
  "label_text": ["string"],
  "confidence": 0.0,
  "notes": "string"
}"""


class AnalyzeFrameRequest(BaseModel):
    image_base64: str
    video_id: str
    frame_timestamp: float
    filename: str
    # Optional: client-side ZXing barcode results merged in before saving
    client_barcodes: list[str] = []


async def verify_jwt(token: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": SUPABASE_ANON_KEY,
            },
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        return resp.json()


async def call_vision_ai(image_base64: str) -> dict:
    payload = {
        "model": OPENROUTER_MODEL,
        "max_tokens": 512,
        "temperature": 0.1,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"},
                    },
                    {"type": "text", "text": VISION_PROMPT},
                ],
            }
        ],
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://reverse-ai-platform.vercel.app",
                "X-Title": "Reverse AI Studio",
            },
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()
        text = data["choices"][0]["message"]["content"].strip()
        if text.startswith("```"):
            lines = text.splitlines()
            text = "\n".join(lines[1:-1]) if len(lines) > 2 else text
        return json.loads(text)


async def upload_to_supabase_storage(image_base64: str, video_id: str, filename: str) -> str:
    image_bytes = base64.b64decode(image_base64)
    storage_path = f"{video_id}/frames/{filename}"
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{SUPABASE_URL}/storage/v1/object/videos/{storage_path}",
            headers={
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Content-Type": "image/jpeg",
                "x-upsert": "true",
            },
            content=image_bytes,
        )
        resp.raise_for_status()
    return f"{SUPABASE_URL}/storage/v1/object/public/videos/{storage_path}"


async def insert_dataset_image(video_id: str, file_path: str, image_name: str, ai_result: dict) -> dict:
    record = {
        "id": str(uuid.uuid4()),
        "video_id": video_id,
        "file_path": file_path,
        "image_name": image_name,
        "ai_result": ai_result,
        "split_type": "train",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{SUPABASE_URL}/rest/v1/dataset_images",
            headers={
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
            json=record,
        )
        resp.raise_for_status()
        rows = resp.json()
        return rows[0] if rows else record


@app.post("/api/analyze_frame")
async def analyze_frame(
    request: AnalyzeFrameRequest,
    authorization: str = Header(None),
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    token = authorization.split(" ", 1)[1]
    await verify_jwt(token)

    # Call vision AI (OpenRouter → Gemini Flash free)
    try:
        ai_result = await call_vision_ai(request.image_base64)
    except (json.JSONDecodeError, KeyError) as e:
        raise HTTPException(status_code=502, detail=f"Failed to parse AI response: {e}")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"OpenRouter API error: {e.response.text}")

    # Merge client-side ZXing barcode results (deduplicated)
    existing = set(ai_result.get("barcodes") or [])
    for code in request.client_barcodes:
        existing.add(code)
    ai_result["barcodes"] = list(existing)

    # Upload frame to Supabase Storage
    try:
        public_url = await upload_to_supabase_storage(
            request.image_base64, request.video_id, request.filename
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Storage upload error: {e.response.text}")

    # Insert into dataset_images
    try:
        record = await insert_dataset_image(
            video_id=request.video_id,
            file_path=public_url,
            image_name=request.filename,
            ai_result=ai_result,
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Database insert error: {e.response.text}")

    return record
