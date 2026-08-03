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
    # NVIDIA
    "nvidia/nemotron-nano-12b-v2-vl:free",
    # Qwen / Alibaba
    "qwen/qwen2.5-vl-72b-instruct:free",
    "qwen/qwen2.5-vl-7b-instruct:free",
    "qwen/qwen2-vl-72b-instruct:free",
    "qwen/qwen2-vl-7b-instruct:free",
    # Meta Llama
    "meta-llama/llama-4-scout:free",
    "meta-llama/llama-4-maverick:free",
    "meta-llama/llama-3.2-90b-vision-instruct:free",
    "meta-llama/llama-3.2-11b-vision-instruct:free",
    # Google
    "google/gemini-2.0-flash-exp:free",
    "google/gemini-2.5-flash-preview-05-20:free",
    "google/gemma-3-27b-it:free",
    "google/gemma-3-12b-it:free",
    "google/gemma-3-4b-it:free",
    # Mistral
    "mistralai/mistral-small-3.2-24b-instruct:free",
    "mistralai/mistral-small-3.1-24b-instruct:free",
    # Microsoft
    "microsoft/phi-4-multimodal-instruct:free",
    "microsoft/phi-4-vision-instruct:free",
    # ByteDance
    "bytedance-research/ui-tars-72b:free",
    # Moonshot
    "moonshotai/kimi-vl-a3b-thinking:free",
    # InternLM
    "internlm/internvl3-14b:free",
]

VISION_PROMPT = """You are a warehouse packaging QC inspector. Analyze this video frame, detect all objects with bounding boxes, and evaluate 4 packaging checkpoints.

CRITICAL — BOUNDING BOX RULES:
- x, y = top-left corner as PERCENTAGE of image width/height (0 to 100)
- width, height = box size as PERCENTAGE of image width/height (0 to 100)
- Estimate carefully by looking at where each object actually sits in the image
- Different objects MUST have different x,y coordinates — do NOT give same coordinates to all objects

IMAGE GRID REFERENCE:
  Left edge=0%, Right edge=100%, Top=0%, Bottom=100%, Center=50%
  Top-left quadrant:    x≈5–45,  y≈5–45
  Top-right quadrant:   x≈55–90, y≈5–45
  Bottom-left quadrant: x≈5–45,  y≈55–90
  Bottom-right quadrant:x≈55–90, y≈55–90

OBJECTS TO DETECT:
  General: cardboard_box, plastic_bag, envelope, pallet, bin, rack, conveyor_belt, person, hand
  Product: product_item, sku_label, package_surface
  Wrapping: stretch_film, bubble_wrap, tape_roll
  Labels: awb_label, shipping_label, stamp, sticker
  Barcodes: barcode_1d, qr_code, barcode_scanner, label_printer

PACKAGING CHECKPOINTS — evaluate from visual evidence only, set null if not visible:
  CP1 checkpoint_product_correct: true if a product_item or sku_label is clearly visible in frame
  CP2 checkpoint_film_wrapped: true if stretch_film or bubble_wrap visibly covers the package/box
  CP3 checkpoint_awb_attached: true if an awb_label or shipping_label is stuck on the package surface
  CP4 checkpoint_barcode_readable: true ONLY if barcode_1d or qr_code detected with confidence>=0.7 AND tracking_codes or barcodes is non-empty

Return ONLY this JSON (no markdown, no explanation, no code block):
{
  "objects": [
    {"label": "cardboard_box",  "confidence": 0.92, "x": 10, "y": 20, "width": 30, "height": 40, "type": "object"},
    {"label": "awb_label",      "confidence": 0.88, "x": 15, "y": 25, "width": 20, "height": 8,  "type": "text"},
    {"label": "barcode_1d",     "confidence": 0.85, "x": 16, "y": 28, "width": 18, "height": 5,  "type": "text"},
    {"label": "stretch_film",   "confidence": 0.80, "x": 5,  "y": 15, "width": 40, "height": 50, "type": "object"}
  ],
  "tracking_codes": ["VN123456789"],
  "barcodes": ["8935001234567"],
  "packaging_status": "ok",
  "package_count": 1,
  "label_text": ["every", "visible", "text", "word", "code", "in", "image"],
  "confidence": 0.85,
  "notes": "",
  "checkpoint_product_correct": true,
  "checkpoint_film_wrapped": true,
  "checkpoint_awb_attached": true,
  "checkpoint_barcode_readable": true
}

RULES:
- type = "object" for physical items, "text" for label/barcode/text regions
- confidence = float 0.0–1.0
- ONLY include objects you can CLEARLY see — do NOT hallucinate or guess objects that are not visible
- If a shipping label / AWB / barcode is NOT visible in the frame, do NOT include it in objects[]
- Each object gets its OWN unique x,y position
- label_text: extract EVERY piece of text visible — product names, codes, numbers, addresses, dates
- checkpoint values: true/false/null only — null means that stage is not visible in this frame
- Set checkpoint to null (not false) when the relevant item simply isn't in frame yet"""

TEXT_ONLY_PROMPT = """You are an OCR assistant. Extract ALL text visible in this image — every word, number, code, date, address, product name, tracking number, barcode value — anything that can be read.

Return ONLY this JSON (no markdown, no explanation, no code block):
{
  "objects": [],
  "tracking_codes": ["any tracking/shipment codes like VN123456789VN, 86185..."],
  "barcodes": ["any barcode or QR values you can decode"],
  "packaging_status": "unknown",
  "package_count": 0,
  "label_text": ["every", "single", "word", "number", "code", "visible", "in", "image"],
  "confidence": 0.9,
  "notes": "raw text extraction mode"
}

IMPORTANT: label_text must contain ALL readable text from the image, one token per entry. Do not skip anything."""


class AnalyzeFrameRequest(BaseModel):
    image_base64: str = ""        # base64 string OR empty when image_url is provided
    image_url: str = ""           # fetch image from URL on server side (avoids browser CORS)
    crop: dict | None = None      # optional {x,y,width,height} in % to crop before analysis
    video_id: str
    frame_timestamp: float
    filename: str
    client_barcodes: list[str] = []
    client_tracking_codes: list[str] = []
    client_label_text: list[str] = []
    preferred_model: str = ""
    text_only: bool = False       # skip object detection, extract all visible text only
    ocr_only: bool = False        # skip AI entirely — save frame with client-side OCR results

# region text → approximate bounding box (fallback for old-format models)
_REGION_COORDS: dict[str, tuple[float, float, float, float]] = {
    "top-left":      (2,  2,  30, 28),
    "top-center":    (35, 2,  30, 28),
    "top-right":     (68, 2,  30, 28),
    "center-left":   (2,  36, 30, 28),
    "center":        (35, 36, 30, 28),
    "center-right":  (68, 36, 30, 28),
    "bottom-left":   (2,  70, 30, 28),
    "bottom-center": (35, 70, 30, 28),
    "bottom-right":  (68, 70, 30, 28),
    "left":          (2,  36, 30, 28),
    "right":         (68, 36, 30, 28),
    "top":           (35, 2,  30, 28),
    "bottom":        (35, 70, 30, 28),
    "unknown":       (35, 36, 30, 28),
}

def normalize_objects(raw: list) -> list:
    def _pct(val, fallback: float) -> float:
        try:
            v = float(val)
            # If model returned normalized 0–1 instead of 0–100, scale up
            if v <= 1.0:
                v = v * 100.0
            return round(min(max(v, 0.0), 100.0), 2)
        except (TypeError, ValueError):
            return fallback

    normalized = []
    # Track used positions to spread overlapping boxes
    used_positions: list[tuple[float, float]] = []

    for i, obj in enumerate(raw):
        if not isinstance(obj, dict):
            continue
        label = str(obj.get("label") or obj.get("class") or obj.get("name") or "").strip().lower().replace(" ", "_")
        if not label:
            continue

        conf = obj.get("confidence") or obj.get("score") or obj.get("prob") or 0.5
        try:
            conf = float(conf)
            if conf > 1.0:
                conf = conf / 100.0
            conf = round(min(max(conf, 0.0), 1.0), 3)
        except (TypeError, ValueError):
            conf = 0.5

        # Try to get coordinates — prefer x/y/width/height, fallback to bbox dict, then region text
        has_coords = any(obj.get(k) is not None for k in ("x", "y", "width", "height", "x1", "y1", "w", "h"))

        if has_coords:
            x = _pct(obj.get("x") if obj.get("x") is not None else obj.get("x1"), None)
            y = _pct(obj.get("y") if obj.get("y") is not None else obj.get("y1"), None)
            w = _pct(obj.get("width") if obj.get("width") is not None else obj.get("w"), None)
            h = _pct(obj.get("height") if obj.get("height") is not None else obj.get("h"), None)

            # Handle x1,y1,x2,y2 format → convert to x,y,w,h
            if w is None and obj.get("x2") is not None:
                x2 = _pct(obj.get("x2"), 0.0)
                w = round(abs(x2 - (x or 0)), 2)
            if h is None and obj.get("y2") is not None:
                y2 = _pct(obj.get("y2"), 0.0)
                h = round(abs(y2 - (y or 0)), 2)

            x = x if x is not None else 5.0
            y = y if y is not None else 5.0
            w = w if w is not None else 20.0
            h = h if h is not None else 20.0
        elif obj.get("bbox") and isinstance(obj["bbox"], (list, dict)):
            # Some models return {"bbox": [x, y, w, h]} or {"bbox": {"x":..}}
            bbox = obj["bbox"]
            if isinstance(bbox, list) and len(bbox) >= 4:
                x, y, w, h = (_pct(bbox[0], 5.0), _pct(bbox[1], 5.0),
                               _pct(bbox[2], 20.0), _pct(bbox[3], 20.0))
            elif isinstance(bbox, dict):
                x = _pct(bbox.get("x") or bbox.get("left"), 5.0)
                y = _pct(bbox.get("y") or bbox.get("top"), 5.0)
                w = _pct(bbox.get("width") or bbox.get("w"), 20.0)
                h = _pct(bbox.get("height") or bbox.get("h"), 20.0)
            else:
                x, y, w, h = 5.0, 5.0, 20.0, 20.0
        else:
            # Fallback: convert region text to approximate coords
            region = str(obj.get("region") or obj.get("location") or "center").lower().strip()
            rx, ry, rw, rh = _REGION_COORDS.get(region, _REGION_COORDS["center"])
            # Offset slightly by index so overlapping region-boxes don't stack exactly
            x, y, w, h = rx + (i % 3) * 2, ry + (i // 3) * 4, rw, rh

        # Spread boxes that land on the exact same spot (model bug)
        pos_key = (round(x), round(y))
        if pos_key in used_positions:
            offset = used_positions.count(pos_key) * 5
            x = min(x + offset, 75.0)
            y = min(y + offset * 0.5, 70.0)
        used_positions.append((round(x), round(y)))

        normalized.append({
            "label": label,
            "confidence": conf,
            "x": x,
            "y": y,
            "width": w,
            "height": h,
            "type": obj.get("type") or "object",
            "status": "pending",
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
import base64 as _b64

# Resize base64 image so it fits within OpenRouter's limit (~1MB decoded)
def _shrink_image(image_base64: str, max_bytes: int = 900_000) -> str:
    raw = _b64.b64decode(image_base64)
    if len(raw) <= max_bytes:
        return image_base64
    try:
        from PIL import Image
        import io
        img = Image.open(io.BytesIO(raw))
        # Downscale until under limit
        quality = 75
        scale = 1.0
        while True:
            w = int(img.width * scale)
            h = int(img.height * scale)
            resized = img.resize((max(w, 64), max(h, 64)), Image.LANCZOS)
            buf = io.BytesIO()
            resized.save(buf, format="JPEG", quality=quality)
            if buf.tell() <= max_bytes or quality <= 40:
                break
            quality -= 10
            if quality <= 40 and scale > 0.4:
                scale -= 0.15
                quality = 65
        return _b64.b64encode(buf.getvalue()).decode()
    except Exception:
        # PIL not available — truncate by re-encoding at lower quality not possible, return original
        return image_base64

async def _call_one_model(image_base64: str, model: str, client: httpx.AsyncClient, prompt: str = VISION_PROMPT) -> dict:
    payload = {
        "model": model,
        "max_tokens": 2048,
        "temperature": 0.1,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"},
                    },
                    {"type": "text", "text": prompt},
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


async def call_vision_ai(image_base64: str, preferred_model: str = "", text_only: bool = False) -> tuple[dict, str]:
    """Try preferred model first, then fallback list on 429 / rate-limit. Returns (result, model_used)."""
    prompt = TEXT_ONLY_PROMPT if text_only else VISION_PROMPT
    order = list(VISION_MODELS)
    if preferred_model and preferred_model in order:
        order.remove(preferred_model)
        order.insert(0, preferred_model)
    elif preferred_model:
        order.insert(0, preferred_model)

    # Shrink image if too large for OpenRouter (~1MB decoded limit)
    image_base64 = _shrink_image(image_base64)

    last_error: Exception | None = None
    async with httpx.AsyncClient(timeout=90.0) as client:
        for model in order:
            try:
                result = await _call_one_model(image_base64, model, client, prompt)
                return result, model
            except httpx.TimeoutException:
                last_error = ValueError(f"{model}: timeout")
                continue  # try next model on timeout
            except httpx.HTTPStatusError as e:
                if e.response.status_code in (400, 404, 429, 500, 502, 503):
                    body = e.response.text[:300]
                    last_error = ValueError(f"{model} HTTP {e.response.status_code}: {body}")
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


async def _fetch_and_prepare_image(request: AnalyzeFrameRequest) -> str:
    """Resolve image_base64: fetch from URL server-side if needed, then apply crop."""
    if request.image_url and not request.image_base64:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(request.image_url)
            resp.raise_for_status()
            raw = resp.content
        b64 = _b64.b64encode(raw).decode()
    else:
        b64 = request.image_base64

    # Apply crop if provided
    if request.crop:
        try:
            from PIL import Image
            import io
            cx = float(request.crop.get("x", 0))
            cy = float(request.crop.get("y", 0))
            cw = float(request.crop.get("width", 100))
            ch = float(request.crop.get("height", 100))
            raw_bytes = _b64.b64decode(b64)
            img = Image.open(io.BytesIO(raw_bytes))
            iw, ih = img.size
            left   = int(iw * cx / 100)
            top    = int(ih * cy / 100)
            right  = int(iw * (cx + cw) / 100)
            bottom = int(ih * (cy + ch) / 100)
            cropped = img.crop((left, top, right, bottom))
            buf = io.BytesIO()
            cropped.save(buf, format="JPEG", quality=90)
            b64 = _b64.b64encode(buf.getvalue()).decode()
        except Exception:
            pass  # skip crop on error, use full image

    return b64


@app.post("/api/analyze_frame")
async def analyze_frame(
    request: AnalyzeFrameRequest,
    authorization: str = Header(None),
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    token = authorization.split(" ", 1)[1]
    await verify_jwt(token)

    # Resolve image (fetch from URL if needed, apply crop)
    try:
        image_b64 = await _fetch_and_prepare_image(request)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot load image: {e}")

    # OCR-only mode: skip AI entirely, build result from client-side OCR data
    model_used = "ocr_only"
    if request.ocr_only:
        ai_result = {
            "objects": [], "tracking_codes": list(request.client_tracking_codes),
            "barcodes": list(request.client_barcodes),
            "packaging_status": "unknown", "package_count": 0,
            "label_text": list(request.client_label_text),
            "confidence": 0.0, "notes": "ocr_only",
        }
    else:
        # Call vision AI (OpenRouter) with auto-fallback
        model_used = request.preferred_model or VISION_MODELS[0]
        parse_error_detail = None
        try:
            ai_result, model_used = await call_vision_ai(image_b64, request.preferred_model, request.text_only)
        except HTTPException:
            raise
        except Exception as e:
            parse_error_detail = str(e)
            ai_result = {
                "objects": [], "tracking_codes": [], "barcodes": [],
                "packaging_status": "unknown", "package_count": 0,
                "label_text": [], "confidence": 0.0, "notes": f"parse_error: {parse_error_detail}",
            }

    # Normalize objects array — fix label/confidence field name variations across models
    if isinstance(ai_result.get("objects"), list):
        ai_result["objects"] = normalize_objects(ai_result["objects"])
    else:
        ai_result["objects"] = []

    # Merge client-side results (ZXing barcodes + Tesseract OCR tracking codes)
    # Skip merge in ocr_only mode — data already set from client above
    if not request.ocr_only:
        barcodes = set(ai_result.get("barcodes") or [])
        barcodes.update(request.client_barcodes)
        ai_result["barcodes"] = list(barcodes)

        tracking = set(ai_result.get("tracking_codes") or [])
        tracking.update(request.client_tracking_codes)
        ai_result["tracking_codes"] = list(tracking)

        label_text = list(ai_result.get("label_text") or [])
        label_text.extend(request.client_label_text)
        ai_result["label_text"] = label_text[:100]

    # Upload frame to Supabase Storage (use resolved image_b64, not raw request which may be empty for URL re-analyze)
    try:
        public_url = await upload_to_supabase_storage(
            image_b64, request.video_id, request.filename
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
