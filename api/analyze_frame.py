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

OPENROUTER_MODEL = "nvidia/nemotron-nano-12b-v2-vl:free"

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
    client_barcodes: list[str] = []
    client_tracking_codes: list[str] = []
    client_label_text: list[str] = []


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
        # Strip markdown fences
        if text.startswith("```"):
            lines = text.splitlines()
            text = "\n".join(lines[1:-1]) if len(lines) > 2 else text
        # Extract first JSON object found in response
        import re
        match = re.search(r'\{[\s\S]*\}', text)
        if match:
            text = match.group(0)
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

    # Call vision AI (OpenRouter)
    try:
        ai_result = await call_vision_ai(request.image_base64)
    except (json.JSONDecodeError, KeyError):
        # Model returned non-JSON — save with empty result rather than failing
        ai_result = {
            "tracking_codes": [], "barcodes": [], "packaging_status": "unknown",
            "package_count": 0, "label_text": [], "confidence": 0.0, "notes": "parse_error"
        }
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"OpenRouter API error: {e.response.text}")

    # Merge client-side results (ZXing barcodes + Tesseract OCR tracking codes)
    barcodes = set(ai_result.get("barcodes") or [])
    barcodes.update(request.client_barcodes)
    ai_result["barcodes"] = list(barcodes)

    tracking = set(ai_result.get("tracking_codes") or [])
    tracking.update(request.client_tracking_codes)
    ai_result["tracking_codes"] = list(tracking)

    label_text = list(ai_result.get("label_text") or [])
    label_text.extend(request.client_label_text)
    ai_result["label_text"] = label_text[:5]  # cap to avoid huge payloads

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
