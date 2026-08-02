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

# Ordered fallback list — tried in sequence when rate-limited (429) or unavailable
VISION_MODELS = [
    "nvidia/nemotron-nano-12b-v2-vl:free",       # fast, warehouse-tuned default
    "qwen/qwen2.5-vl-72b-instruct:free",          # strong OCR + object detection
    "qwen/qwen2.5-vl-7b-instruct:free",           # lighter Qwen VL
    "meta-llama/llama-4-scout:free",              # multimodal scout
    "meta-llama/llama-4-maverick:free",           # larger llama4 vision
    "google/gemini-2.0-flash-exp:free",           # Gemini 2.0 Flash — excellent OCR
    "google/gemma-3-27b-it:free",
    "google/gemma-3-12b-it:free",                 # lighter Gemma 3
    "mistralai/mistral-small-3.1-24b-instruct:free",
    "mistralai/mistral-small-3.2-24b-instruct:free", # newer Mistral Small
    "microsoft/phi-4-multimodal-instruct:free",   # Phi-4 multimodal
    "bytedance-research/ui-tars-72b:free",        # UI/document understanding
    "moonshotai/kimi-vl-a3b-thinking:free",       # Kimi VL reasoning
]

VISION_PROMPT = """You are a warehouse AI inspector analyzing a packing/sorting video frame.

Your tasks:
1. OBJECT DETECTION — identify every visible object and its bounding region (rough %).
   Common objects: cardboard_box, shipping_label, barcode_1d, qr_code, hand, tape_roll,
   barcode_scanner, label_printer, knife_cutter, keyboard, mouse, plastic_bag, envelope.
2. TRACKING CODES — extract all order/tracking numbers from labels (numeric or alphanumeric).
3. OCR — extract all readable text from labels and packages.
4. PACKAGING STATUS — "ok", "damaged", or "unknown".
5. PACKAGE COUNT — how many packages are visible.

Return ONLY valid JSON (no markdown, no code fences):
{
  "objects": [
    {"label": "cardboard_box", "confidence": 0.95, "region": "center"},
    {"label": "shipping_label", "confidence": 0.92, "region": "center-left"},
    {"label": "hand", "confidence": 0.98, "region": "bottom-left"},
    {"label": "barcode_1d", "confidence": 0.90, "region": "center-right"}
  ],
  "tracking_codes": ["string"],
  "barcodes": [],
  "packaging_status": "ok|damaged|unknown",
  "package_count": 0,
  "label_text": ["string"],
  "confidence": 0.0,
  "notes": "string"
}

Region values: top-left, top-center, top-right, center-left, center, center-right, bottom-left, bottom-center, bottom-right.
Confidence: float 0.0–1.0. Include ALL visible objects even partially visible."""


class AnalyzeFrameRequest(BaseModel):
    image_base64: str
    video_id: str
    frame_timestamp: float
    filename: str
    client_barcodes: list[str] = []
    client_tracking_codes: list[str] = []
    client_label_text: list[str] = []
    preferred_model: str = ""  # empty = use default fallback order

# Normalize objects array — fix common AI output quirks
def normalize_objects(raw: list) -> list:
    normalized = []
    for obj in raw:
        if not isinstance(obj, dict):
            continue
        label = str(obj.get("label") or obj.get("class") or obj.get("name") or "").strip().lower().replace(" ", "_")
        if not label:
            continue
        conf = obj.get("confidence") or obj.get("score") or obj.get("prob") or 0.5
        try:
            conf = float(conf)
        except (TypeError, ValueError):
            conf = 0.5
        normalized.append({
            "label": label,
            "confidence": round(min(max(conf, 0.0), 1.0), 3),
            "region": obj.get("region") or obj.get("location") or "unknown",
        })
    return normalized


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


import re as _re

async def _call_one_model(image_base64: str, model: str, client: httpx.AsyncClient) -> dict:
    payload = {
        "model": model,
        "max_tokens": 1024,
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
    match = _re.search(r'\{[\s\S]*\}', text)
    if match:
        text = match.group(0)
    return json.loads(text)


async def call_vision_ai(image_base64: str, preferred_model: str = "") -> tuple[dict, str]:
    """Try preferred model first, then fallback list on 429 / rate-limit. Returns (result, model_used)."""
    order = list(VISION_MODELS)
    if preferred_model and preferred_model in order:
        order.remove(preferred_model)
        order.insert(0, preferred_model)
    elif preferred_model:
        order.insert(0, preferred_model)

    last_error: Exception | None = None
    async with httpx.AsyncClient(timeout=60.0) as client:
        for model in order:
            try:
                result = await _call_one_model(image_base64, model, client)
                return result, model
            except httpx.HTTPStatusError as e:
                if e.response.status_code in (404, 429, 500, 502, 503):
                    last_error = e
                    continue  # try next model
                raise
            except (json.JSONDecodeError, KeyError):
                last_error = ValueError(f"{model}: invalid JSON response")
                continue  # try next model

    raise HTTPException(status_code=502, detail=f"All models exhausted. Last error: {last_error}")


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


async def upsert_dataset_image(
    video_id: str, file_path: str, image_name: str,
    ai_result: dict, frame_timestamp: float,
) -> dict:
    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        # Check if record already exists by image_name (unique per video processing run)
        check = await client.get(
            f"{SUPABASE_URL}/rest/v1/dataset_images",
            headers={**headers, "Prefer": "return=representation"},
            params={"video_id": f"eq.{video_id}", "image_name": f"eq.{image_name}", "select": "id"},
        )
        existing = check.json() if check.status_code == 200 else []

        if existing:
            # Update existing record
            row_id = existing[0]["id"]
            patch = {"ai_result": ai_result, "file_path": file_path}
            resp = await client.patch(
                f"{SUPABASE_URL}/rest/v1/dataset_images",
                headers={**headers, "Prefer": "return=representation"},
                params={"id": f"eq.{row_id}"},
                json=patch,
            )
            resp.raise_for_status()
            rows = resp.json()
            return rows[0] if rows else {**patch, "id": row_id}
        else:
            # Insert new record
            record = {
                "id": str(uuid.uuid4()),
                "video_id": video_id,
                "file_path": file_path,
                "image_name": image_name,
                "frame_timestamp": frame_timestamp,
                "ai_result": ai_result,
                "split_type": "train",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            resp = await client.post(
                f"{SUPABASE_URL}/rest/v1/dataset_images",
                headers={**headers, "Prefer": "return=representation"},
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

    # Call vision AI (OpenRouter) with auto-fallback
    model_used = request.preferred_model or VISION_MODELS[0]
    parse_error_detail = None
    try:
        ai_result, model_used = await call_vision_ai(request.image_base64, request.preferred_model)
    except HTTPException:
        raise
    except Exception as e:
        parse_error_detail = str(e)
        ai_result = {
            "objects": [], "tracking_codes": [], "barcodes": [],
            "packaging_status": "unknown", "package_count": 0,
            "label_text": [], "confidence": 0.0, "notes": f"parse_error: {parse_error_detail}"
        }

    # Normalize objects array — fix label/confidence field name variations across models
    if isinstance(ai_result.get("objects"), list):
        ai_result["objects"] = normalize_objects(ai_result["objects"])
    else:
        ai_result["objects"] = []

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

    # Upsert into dataset_images (no duplicates on reprocess)
    try:
        record = await upsert_dataset_image(
            video_id=request.video_id,
            file_path=public_url,
            image_name=request.filename,
            ai_result=ai_result,
            frame_timestamp=request.frame_timestamp,
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Database upsert error: {e.response.text}")

    return {**record, "model_used": model_used}
