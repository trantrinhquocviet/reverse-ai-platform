"""AI frame analysis — analyze_frame, finalize_video_audit, classify_video_type."""
from __future__ import annotations

import base64
import base64 as _b64
import json
import re as _re
import uuid
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from app.config import settings

router = APIRouter(tags=["AI Analysis"])

# ---------------------------------------------------------------------------
# Config helpers (read from backend Settings)
# ---------------------------------------------------------------------------

def _openrouter_key() -> str:
    return settings.OPEN_ROUTE


VISION_MODELS = [
    "nvidia/nemotron-nano-12b-v2-vl:free",
    "qwen/qwen2.5-vl-72b-instruct:free",
    "qwen/qwen2.5-vl-7b-instruct:free",
    "qwen/qwen2-vl-72b-instruct:free",
    "qwen/qwen2-vl-7b-instruct:free",
    "meta-llama/llama-4-scout:free",
    "meta-llama/llama-4-maverick:free",
    "meta-llama/llama-3.2-90b-vision-instruct:free",
    "meta-llama/llama-3.2-11b-vision-instruct:free",
    "google/gemini-2.0-flash-exp:free",
    "google/gemini-2.5-flash-preview-05-20:free",
    "google/gemma-3-27b-it:free",
    "google/gemma-3-12b-it:free",
    "google/gemma-3-4b-it:free",
    "mistralai/mistral-small-3.2-24b-instruct:free",
    "mistralai/mistral-small-3.1-24b-instruct:free",
    "microsoft/phi-4-multimodal-instruct:free",
    "microsoft/phi-4-vision-instruct:free",
    "bytedance-research/ui-tars-72b:free",
    "moonshotai/kimi-vl-a3b-thinking:free",
    "internlm/internvl3-14b:free",
]

# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

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
    {"label": "cardboard_box", "confidence": 0.92, "x": 10, "y": 20, "width": 30, "height": 40, "type": "object"}
  ],
  "tracking_codes": [],
  "barcodes": [],
  "packaging_status": "ok",
  "package_count": 1,
  "label_text": [],
  "confidence": 0.85,
  "notes": "",
  "checkpoint_product_correct": null,
  "checkpoint_film_wrapped": null,
  "checkpoint_awb_attached": null,
  "checkpoint_barcode_readable": null
}"""

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

IMPORTANT: label_text must contain ALL readable text from the image, one token per entry."""

ACTIVE_BOX_PROMPT = """You are a warehouse computer vision assistant. A fixed overhead camera watches a packing/unpacking workstation.

Your ONLY task: identify the ONE parcel that the operator is CURRENTLY handling (touching, lifting, rotating, opening, scanning, or packing). This is called the ACTIVE_PARCEL.

SCORING SIGNALS (in priority order):
1. HAND INTERACTION (strongest) — box touched by / between / overlapping with operator hands
2. MOTION — box that is moving, being lifted, rotated, or repositioned
3. WORK ZONE — box on the central workstation table (not stacked on shelves/sides)
4. LABEL VISIBILITY — shipping label / barcode visible (weak signal — ignore background boxes with labels)

RULES:
- Return EXACTLY ONE active_parcel bounding box (the highest-scoring candidate)
- If NO parcel is actively being handled, set active_parcel_found: false
- Bounding box coordinates: x, y = top-left as % (0–100); width, height as %

Return ONLY this JSON (no markdown, no explanation):
{
  "active_parcel_found": true,
  "active_parcel_bbox": {"x": 25.0, "y": 30.0, "width": 35.0, "height": 40.0, "confidence": 0.91},
  "signals": {"hand_interaction": 0.95, "motion": 0.80, "work_zone": 0.90, "parcel_label": 0.60},
  "notes": ""
}"""

AWB_DETECT_PROMPT = """You are a warehouse vision assistant. Find the AWB/shipping label on the active parcel and extract ALL readable text.

Return ONLY this JSON (no markdown, no explanation):
{
  "awb_found": true,
  "awb_bbox": {"x": 20.0, "y": 35.0, "width": 30.0, "height": 20.0, "confidence": 0.88},
  "text_regions": [],
  "tracking_codes": [],
  "barcodes": [],
  "order_codes": [],
  "route_info": [],
  "raw_text": [],
  "ocr_confidence": 0.87,
  "notes": ""
}"""

PRODUCT_DETECT_PROMPT = """You are a warehouse vision assistant. Determine the PARCEL STATE and detect products removed from the parcel.

PARCEL STATE — choose ONE:
  PARCEL_RECEIVED | PARCEL_HANDLED | PARCEL_OPENING | PARCEL_OPENED |
  PRODUCT_VISIBLE | PRODUCT_REMOVED | PRODUCT_INSPECTION | PROCESS_COMPLETED

Return ONLY this JSON (no markdown):
{
  "parcel_state": "PARCEL_HANDLED",
  "parcel_state_confidence": 0.82,
  "products": [],
  "events": [],
  "notes": ""
}"""

VIDEO_AUDIT_PROMPT = """You are a warehouse video quality auditor.

Analyze THIS SINGLE FRAME for video and process quality issues. Distinguish:
1. WAREHOUSE error (source=WAREHOUSE): warehouse failed to provide evidence
2. AI limitation (source=AI): evidence exists but AI cannot read it
3. System issue (source=SYSTEM)

Return ONLY this JSON (no markdown):
{
  "wh_errors": [],
  "evidence_checklist": {
    "active_parcel": true, "awb_visible": false, "awb_readable": false,
    "opening": false, "product_visible": false, "barcode": false,
    "product_text": false, "work_zone_clear": true
  },
  "quality_components": {
    "camera_quality": 0.85, "awb_visibility": 0.0, "parcel_continuity": 0.90,
    "opening_evidence": 0.0, "product_visibility": 0.0, "identification_evidence": 0.0, "quantity_evidence": 0.0
  },
  "event_audit": {
    "active_parcel": "PASS", "awb_visible": "NOT_VISIBLE", "awb_readable": "NOT_VISIBLE",
    "opening": "NOT_VISIBLE", "product_emergence": "NOT_VISIBLE", "product_removed": "NOT_VISIBLE",
    "product_full_view": "NOT_VISIBLE", "barcode": "NOT_VISIBLE", "product_text": "NOT_VISIBLE",
    "quantity": "NOT_VISIBLE", "process_completed": "NOT_VISIBLE"
  },
  "video_evidence_score": 50,
  "case_status": "HUMAN_REVIEW_REQUIRED",
  "notes": ""
}"""

VIDEO_CLASSIFY_PROMPT = """You are a warehouse video classification assistant. A fixed overhead camera watches a packing/unpacking workstation.

Analyze THIS SINGLE FRAME and report the current observable state.

- box_state: CLOSED | OPEN | SEALED | UNKNOWN
- product_location: OUTSIDE_BOX | INSIDE_BOX | PARTIAL | UNKNOWN
- seal_state: SEALED | OPENED | NOT_VISIBLE
- action (pick ONE):
    INSERT_PRODUCT | REMOVE_PRODUCT | OPEN_BOX | CLOSE_BOX |
    APPLY_SEAL | REMOVE_SEAL | INSPECT_PRODUCT | NONE

Return ONLY this JSON (no markdown):
{
  "box_state": "OPEN",
  "product_location": "OUTSIDE_BOX",
  "product_visibility": true,
  "seal_state": "NOT_VISIBLE",
  "action": "INSERT_PRODUCT",
  "confidence": 0.82,
  "notes": ""
}"""

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_REGION_COORDS: dict[str, tuple[float, float, float, float]] = {
    "top-left": (2, 2, 30, 28), "top-center": (35, 2, 30, 28), "top-right": (68, 2, 30, 28),
    "center-left": (2, 36, 30, 28), "center": (35, 36, 30, 28), "center-right": (68, 36, 30, 28),
    "bottom-left": (2, 70, 30, 28), "bottom-center": (35, 70, 30, 28), "bottom-right": (68, 70, 30, 28),
    "left": (2, 36, 30, 28), "right": (68, 36, 30, 28),
    "top": (35, 2, 30, 28), "bottom": (35, 70, 30, 28), "unknown": (35, 36, 30, 28),
}


def normalize_objects(raw: list) -> list:
    def _pct(val, fallback: float) -> float:
        try:
            v = float(val)
            if v <= 1.0:
                v = v * 100.0
            return round(min(max(v, 0.0), 100.0), 2)
        except (TypeError, ValueError):
            return fallback

    normalized = []
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

        has_coords = any(obj.get(k) is not None for k in ("x", "y", "width", "height", "x1", "y1", "w", "h"))
        if has_coords:
            x = _pct(obj.get("x") if obj.get("x") is not None else obj.get("x1"), None)
            y = _pct(obj.get("y") if obj.get("y") is not None else obj.get("y1"), None)
            w = _pct(obj.get("width") if obj.get("width") is not None else obj.get("w"), None)
            h = _pct(obj.get("height") if obj.get("height") is not None else obj.get("h"), None)
            if w is None and obj.get("x2") is not None:
                w = round(abs(_pct(obj.get("x2"), 0.0) - (x or 0)), 2)
            if h is None and obj.get("y2") is not None:
                h = round(abs(_pct(obj.get("y2"), 0.0) - (y or 0)), 2)
            x = x if x is not None else 5.0
            y = y if y is not None else 5.0
            w = w if w is not None else 20.0
            h = h if h is not None else 20.0
        elif obj.get("bbox") and isinstance(obj["bbox"], (list, dict)):
            bbox = obj["bbox"]
            if isinstance(bbox, list) and len(bbox) >= 4:
                x, y, w, h = _pct(bbox[0], 5.0), _pct(bbox[1], 5.0), _pct(bbox[2], 20.0), _pct(bbox[3], 20.0)
            elif isinstance(bbox, dict):
                x = _pct(bbox.get("x") or bbox.get("left"), 5.0)
                y = _pct(bbox.get("y") or bbox.get("top"), 5.0)
                w = _pct(bbox.get("width") or bbox.get("w"), 20.0)
                h = _pct(bbox.get("height") or bbox.get("h"), 20.0)
            else:
                x, y, w, h = 5.0, 5.0, 20.0, 20.0
        else:
            region = str(obj.get("region") or obj.get("location") or "center").lower().strip()
            rx, ry, rw, rh = _REGION_COORDS.get(region, _REGION_COORDS["center"])
            x, y, w, h = rx + (i % 3) * 2, ry + (i // 3) * 4, rw, rh

        pos_key = (round(x), round(y))
        if pos_key in used_positions:
            offset = used_positions.count(pos_key) * 5
            x = min(x + offset, 75.0)
            y = min(y + offset * 0.5, 70.0)
        used_positions.append((round(x), round(y)))
        normalized.append({"label": label, "confidence": conf, "x": x, "y": y, "width": w, "height": h,
                            "type": obj.get("type") or "object", "status": "pending"})
    return normalized


def _shrink_image(image_base64: str, max_bytes: int = 900_000) -> str:
    raw = _b64.b64decode(image_base64)
    if len(raw) <= max_bytes:
        return image_base64
    try:
        from PIL import Image
        import io
        img = Image.open(io.BytesIO(raw))
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
        return image_base64


async def verify_jwt(token: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{settings.SUPABASE_URL}/auth/v1/user",
            headers={"Authorization": f"Bearer {token}", "apikey": settings.SUPABASE_ANON_KEY},
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        return resp.json()


async def _call_one_model(image_base64: str, model: str, client: httpx.AsyncClient, prompt: str) -> dict:
    payload = {
        "model": model,
        "max_tokens": 2048,
        "temperature": 0.1,
        "messages": [{"role": "user", "content": [
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}},
            {"type": "text", "text": prompt},
        ]}],
    }
    resp = await client.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {_openrouter_key()}",
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


async def call_vision_ai(
    image_base64: str,
    preferred_model: str = "",
    text_only: bool = False,
    active_parcel_only: bool = False,
    awb_detect: bool = False,
    product_detect: bool = False,
    video_audit: bool = False,
    _prompt_override: str = "",
) -> tuple[dict, str]:
    if _prompt_override:
        prompt = _prompt_override
    elif active_parcel_only:
        prompt = ACTIVE_BOX_PROMPT
    elif awb_detect:
        prompt = AWB_DETECT_PROMPT
    elif product_detect:
        prompt = PRODUCT_DETECT_PROMPT
    elif video_audit:
        prompt = VIDEO_AUDIT_PROMPT
    elif text_only:
        prompt = TEXT_ONLY_PROMPT
    else:
        prompt = VISION_PROMPT

    order = list(VISION_MODELS)
    if preferred_model and preferred_model in order:
        order.remove(preferred_model)
        order.insert(0, preferred_model)
    elif preferred_model:
        order.insert(0, preferred_model)

    image_base64 = _shrink_image(image_base64)
    last_error: Exception | None = None

    async with httpx.AsyncClient(timeout=90.0) as client:
        for model in order:
            try:
                result = await _call_one_model(image_base64, model, client, prompt)
                return result, model
            except httpx.TimeoutException:
                last_error = ValueError(f"{model}: timeout")
            except httpx.HTTPStatusError as e:
                if e.response.status_code in (400, 404, 429, 500, 502, 503):
                    last_error = ValueError(f"{model} HTTP {e.response.status_code}")
                else:
                    raise
            except (json.JSONDecodeError, KeyError):
                last_error = ValueError(f"{model}: invalid JSON response")

    raise HTTPException(status_code=502, detail=f"All models exhausted. Last error: {last_error}")


async def upload_to_supabase_storage(image_base64: str, video_id: str, filename: str) -> str:
    image_bytes = base64.b64decode(image_base64)
    storage_path = f"{video_id}/frames/{filename}"
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{settings.SUPABASE_URL}/storage/v1/object/videos/{storage_path}",
            headers={
                "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
                "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
                "Content-Type": "image/jpeg",
                "x-upsert": "true",
            },
            content=image_bytes,
        )
        resp.raise_for_status()
    return f"{settings.SUPABASE_URL}/storage/v1/object/public/videos/{storage_path}"


async def upsert_dataset_image(video_id: str, file_path: str, image_name: str, ai_result: dict, frame_timestamp: float) -> dict:
    headers = {
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        check = await client.get(
            f"{settings.SUPABASE_URL}/rest/v1/dataset_images",
            headers={**headers, "Prefer": "return=representation"},
            params={"video_id": f"eq.{video_id}", "image_name": f"eq.{image_name}", "select": "id"},
        )
        existing = check.json() if check.status_code == 200 else []
        if existing:
            row_id = existing[0]["id"]
            patch = {"ai_result": ai_result, "file_path": file_path}
            resp = await client.patch(
                f"{settings.SUPABASE_URL}/rest/v1/dataset_images",
                headers={**headers, "Prefer": "return=representation"},
                params={"id": f"eq.{row_id}"},
                json=patch,
            )
            resp.raise_for_status()
            rows = resp.json()
            return rows[0] if rows else {**patch, "id": row_id}
        else:
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
                f"{settings.SUPABASE_URL}/rest/v1/dataset_images",
                headers={**headers, "Prefer": "return=representation"},
                json=record,
            )
            resp.raise_for_status()
            rows = resp.json()
            return rows[0] if rows else record


async def _fetch_and_prepare_image(request: "AnalyzeFrameRequest") -> str:
    if request.image_url and not request.image_base64:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(request.image_url)
            resp.raise_for_status()
            b64 = _b64.b64encode(resp.content).decode()
    else:
        b64 = request.image_base64

    if request.crop:
        try:
            from PIL import Image
            import io
            cx = float(request.crop.get("x", 0))
            cy = float(request.crop.get("y", 0))
            cw = float(request.crop.get("width", 100))
            ch = float(request.crop.get("height", 100))
            img = Image.open(io.BytesIO(_b64.b64decode(b64)))
            iw, ih = img.size
            cropped = img.crop((int(iw * cx / 100), int(ih * cy / 100),
                                int(iw * (cx + cw) / 100), int(ih * (cy + ch) / 100)))
            buf = io.BytesIO()
            cropped.save(buf, format="JPEG", quality=90)
            b64 = _b64.b64encode(buf.getvalue()).decode()
        except Exception:
            pass
    return b64


def _infer_video_type(evidence: list[dict]) -> tuple[str, float]:
    PACKING_ACTIONS = {"INSERT_PRODUCT", "CLOSE_BOX", "APPLY_SEAL"}
    UNBOXING_ACTIONS = {"REMOVE_PRODUCT", "OPEN_BOX", "REMOVE_SEAL", "INSPECT_PRODUCT"}
    packing_hits = sum(1 for e in evidence if e.get("action") in PACKING_ACTIONS)
    unboxing_hits = sum(1 for e in evidence if e.get("action") in UNBOXING_ACTIONS)
    states = [e.get("box_state") for e in evidence if e.get("box_state") not in (None, "UNKNOWN")]
    first_state = states[0] if states else None
    last_state = states[-1] if states else None
    if first_state in ("OPEN", None) and last_state in ("CLOSED", "SEALED"):
        packing_hits += 2
    if first_state in ("CLOSED", "SEALED") and last_state in ("OPEN", None):
        unboxing_hits += 2
    total = packing_hits + unboxing_hits
    if total == 0:
        return "UNKNOWN_VIDEO", 0.3
    ratio = packing_hits / total
    if ratio >= 0.60:
        return "PACKING_VIDEO", round(min(0.50 + ratio * 0.45, 0.95), 2)
    elif ratio <= 0.40:
        return "UNBOXING_VIDEO", round(min(0.50 + (1.0 - ratio) * 0.45, 0.95), 2)
    return "UNKNOWN_VIDEO", round(0.30 + abs(ratio - 0.5) * 0.4, 2)


# ---------------------------------------------------------------------------
# Request schema
# ---------------------------------------------------------------------------

class AnalyzeFrameRequest(BaseModel):
    image_base64: str = ""
    image_url: str = ""
    crop: dict | None = None
    video_id: str
    frame_timestamp: float
    filename: str
    client_barcodes: list[str] = []
    client_tracking_codes: list[str] = []
    client_label_text: list[str] = []
    preferred_model: str = ""
    text_only: bool = False
    ocr_only: bool = False
    active_parcel_only: bool = False
    awb_detect: bool = False
    product_detect: bool = False
    event_type: str = ""
    video_audit: bool = False


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/api/analyze_frame")
async def analyze_frame(request: AnalyzeFrameRequest, authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    await verify_jwt(authorization.split(" ", 1)[1])

    try:
        image_b64 = await _fetch_and_prepare_image(request)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot load image: {e}")

    model_used = "ocr_only"

    if request.ocr_only:
        ai_result = {
            "objects": [], "tracking_codes": list(request.client_tracking_codes),
            "barcodes": list(request.client_barcodes),
            "packaging_status": "unknown", "package_count": 0,
            "label_text": list(request.client_label_text),
            "confidence": 0.0, "notes": "ocr_only",
            **({"event_type": request.event_type} if request.event_type else {}),
        }

    elif request.active_parcel_only or request.awb_detect or request.product_detect or request.video_audit:
        supabase_headers = {
            "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
            "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
        }

        async def _fetch_existing() -> tuple[str | None, dict]:
            async with httpx.AsyncClient(timeout=15.0) as _c:
                r = await _c.get(
                    f"{settings.SUPABASE_URL}/rest/v1/dataset_images",
                    headers=supabase_headers,
                    params={"video_id": f"eq.{request.video_id}", "image_name": f"eq.{request.filename}", "select": "id,ai_result"},
                )
                rows = r.json() if r.status_code == 200 else []
            if rows:
                return rows[0]["id"], (rows[0].get("ai_result") or {})
            return None, {}

        async def _patch_db(row_id: str, merged: dict) -> None:
            async with httpx.AsyncClient(timeout=15.0) as _c:
                await _c.patch(
                    f"{settings.SUPABASE_URL}/rest/v1/dataset_images",
                    headers={**supabase_headers, "Content-Type": "application/json", "Prefer": "return=representation"},
                    params={"id": f"eq.{row_id}"},
                    json={"ai_result": merged},
                )

        model_used = request.preferred_model or VISION_MODELS[0]
        row_id, existing_ai = await _fetch_existing()

        if request.active_parcel_only:
            try:
                step_result, model_used = await call_vision_ai(image_b64, request.preferred_model, active_parcel_only=True)
            except HTTPException:
                raise
            except Exception as e:
                step_result = {"active_parcel_found": False, "active_parcel_bbox": None, "notes": str(e)}
            extra = {
                "active_parcel_found": step_result.get("active_parcel_found", False),
                "active_parcel_bbox": step_result.get("active_parcel_bbox"),
                "active_parcel_signals": step_result.get("signals"),
            }

        elif request.awb_detect:
            apb = existing_ai.get("active_parcel_bbox")
            awb_b64 = image_b64
            if apb and isinstance(apb, dict):
                try:
                    from PIL import Image as _PIL
                    import io as _io
                    raw_bytes = _b64.b64decode(image_b64)
                    pil_img = _PIL.open(_io.BytesIO(raw_bytes))
                    iw, ih = pil_img.size
                    margin = 0.05
                    cx = max(apb["x"] - margin * 100, 0) / 100
                    cy = max(apb["y"] - margin * 100, 0) / 100
                    cr = min((apb["x"] + apb["width"] + margin * 100), 100) / 100
                    cb = min((apb["y"] + apb["height"] + margin * 100), 100) / 100
                    cropped = pil_img.crop((int(iw * cx), int(ih * cy), int(iw * cr), int(ih * cb)))
                    buf = _io.BytesIO()
                    cropped.save(buf, format="JPEG", quality=90)
                    awb_b64 = _b64.b64encode(buf.getvalue()).decode()
                except Exception:
                    pass
            try:
                step_result, model_used = await call_vision_ai(awb_b64, request.preferred_model, awb_detect=True)
            except HTTPException:
                raise
            except Exception as e:
                step_result = {"awb_found": False, "awb_bbox": None, "notes": str(e)}
            awb_codes = step_result.get("tracking_codes") or []
            awb_barcodes = step_result.get("barcodes") or []
            extra = {
                "awb_found": step_result.get("awb_found", False),
                "awb_bbox": step_result.get("awb_bbox"),
                "awb_text_regions": step_result.get("text_regions", []),
                "awb_order_codes": step_result.get("order_codes", []),
                "awb_route_info": step_result.get("route_info", []),
                "awb_raw_text": step_result.get("raw_text", []),
                "awb_ocr_confidence": step_result.get("ocr_confidence", 0.0),
                "tracking_codes": list(set((existing_ai.get("tracking_codes") or []) + awb_codes)),
                "barcodes": list(set((existing_ai.get("barcodes") or []) + awb_barcodes)),
            }

        elif request.product_detect:
            try:
                step_result, model_used = await call_vision_ai(image_b64, request.preferred_model, product_detect=True)
            except HTTPException:
                raise
            except Exception as e:
                step_result = {"parcel_state": "UNKNOWN", "products": [], "events": [], "notes": str(e)}
            extra = {
                "parcel_state": step_result.get("parcel_state", "UNKNOWN"),
                "parcel_state_confidence": step_result.get("parcel_state_confidence", 0.0),
                "products": step_result.get("products", []),
                "product_events": step_result.get("events", []),
            }

        else:  # video_audit
            try:
                step_result, model_used = await call_vision_ai(image_b64, request.preferred_model, video_audit=True)
            except HTTPException:
                raise
            except Exception as e:
                step_result = {"wh_errors": [], "video_evidence_score": 0, "case_status": "HUMAN_REVIEW_REQUIRED", "notes": str(e)}
            prev_errors: list = existing_ai.get("wh_errors") or []
            new_errors: list = step_result.get("wh_errors") or []
            existing_codes = {e.get("error_code") for e in prev_errors}
            merged_errors = prev_errors + [e for e in new_errors if e.get("error_code") not in existing_codes]
            prev_scores: list = existing_ai.get("audit_scores_history") or []
            new_score = step_result.get("video_evidence_score", 0)
            prev_scores.append(new_score)
            avg_score = round(sum(prev_scores) / len(prev_scores))
            status_priority = ["WH_PROCESS_FAIL", "HUMAN_REVIEW_REQUIRED", "AI_UNCERTAIN", "PASS"]
            new_status = step_result.get("case_status", "HUMAN_REVIEW_REQUIRED")
            prev_status = existing_ai.get("case_status", "PASS")
            case_status = new_status if status_priority.index(new_status) < status_priority.index(prev_status) else prev_status
            prev_checklist: dict = existing_ai.get("evidence_checklist") or {}
            new_checklist: dict = step_result.get("evidence_checklist") or {}
            merged_checklist = {k: prev_checklist.get(k, False) or new_checklist.get(k, False)
                                for k in set(list(prev_checklist) + list(new_checklist))}
            extra = {
                "wh_errors": merged_errors,
                "evidence_checklist": merged_checklist,
                "quality_components": step_result.get("quality_components"),
                "video_evidence_score": avg_score,
                "audit_scores_history": prev_scores,
                "case_status": case_status,
            }

        merged_ai = {**existing_ai, **extra}
        if row_id:
            await _patch_db(row_id, merged_ai)
            return {"id": row_id, "ai_result": merged_ai, "model_used": model_used}
        return {"ai_result": merged_ai, "model_used": model_used}

    else:
        model_used = request.preferred_model or VISION_MODELS[0]
        try:
            ai_result, model_used = await call_vision_ai(image_b64, request.preferred_model, request.text_only)
        except HTTPException:
            raise
        except Exception as e:
            ai_result = {
                "objects": [], "tracking_codes": [], "barcodes": [],
                "packaging_status": "unknown", "package_count": 0,
                "label_text": [], "confidence": 0.0, "notes": f"parse_error: {e}",
            }

    if isinstance(ai_result.get("objects"), list):
        ai_result["objects"] = normalize_objects(ai_result["objects"])
    else:
        ai_result["objects"] = []

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

    try:
        public_url = await upload_to_supabase_storage(image_b64, request.video_id, request.filename)
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Storage upload error: {e.response.text}")

    try:
        record = await upsert_dataset_image(
            video_id=request.video_id, file_path=public_url,
            image_name=request.filename, ai_result=ai_result,
            frame_timestamp=request.frame_timestamp,
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Database upsert error: {e.response.text}")

    return {**record, "model_used": model_used}


@router.post("/api/finalize_video_audit")
async def finalize_video_audit(video_id: str, authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    await verify_jwt(authorization.split(" ", 1)[1])

    headers = {
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.get(
            f"{settings.SUPABASE_URL}/rest/v1/dataset_images"
            f"?video_id=eq.{video_id}&select=ai_result,image_name,created_at&order=created_at.asc",
            headers=headers,
        )
        if not resp.is_success:
            raise HTTPException(status_code=502, detail=f"DB fetch error: {resp.text}")
        frames = resp.json()

    if not frames:
        raise HTTPException(status_code=404, detail="No frames found for this video")

    merged_errors: list[dict] = []
    seen_codes: set[str] = set()
    merged_checklist: dict[str, str] = {}
    quality_sums: dict[str, float] = {}
    quality_counts: dict[str, int] = {}

    for frame in frames:
        ai = frame.get("ai_result") or {}
        for err in (ai.get("wh_errors") or []):
            code = err.get("error_code", "")
            if not code:
                continue
            if code in seen_codes:
                for existing in merged_errors:
                    if existing["error_code"] == code:
                        if err.get("confidence", 0) > existing.get("confidence", 0):
                            existing["confidence"] = err["confidence"]
                        break
            else:
                seen_codes.add(code)
                merged_errors.append({**err})
        STATUS_RANK = {"PASS": 3, "NOT_REQUIRED": 2, "UNCERTAIN": 1, "FAIL": 0}
        for step, status in (ai.get("event_audit") or {}).items():
            cur = merged_checklist.get(step)
            if cur is None or STATUS_RANK.get(status, 0) > STATUS_RANK.get(cur, 0):
                merged_checklist[step] = status
        for k, v in (ai.get("quality_components") or {}).items():
            if isinstance(v, (int, float)):
                quality_sums[k] = quality_sums.get(k, 0.0) + v
                quality_counts[k] = quality_counts.get(k, 0) + 1

    quality_avg = {k: quality_sums[k] / quality_counts[k] for k in quality_sums}

    hasCritical = any(e.get("severity") == "CRITICAL" and e.get("source") == "WAREHOUSE" and e.get("confidence", 0) >= 0.85 for e in merged_errors)
    hasWarning = any(e.get("severity") in ("WARNING", "CRITICAL") for e in merged_errors)
    score = max(0, 100 - sum(15 if e.get("severity") == "CRITICAL" else 5 for e in merged_errors))
    if hasCritical:
        status = "WH_PROCESS_FAIL"
    elif score >= 70 and not hasWarning:
        status = "PASS"
    elif score >= 70:
        status = "PASS_WITH_WARNING"
    else:
        status = "HUMAN_REVIEW_REQUIRED"

    video_audit_result = {
        "video_id": video_id,
        "case_status": status,
        "video_evidence_score": score,
        "wh_errors": merged_errors,
        "event_audit": merged_checklist,
        "quality_components": quality_avg,
        "frame_count": len(frames),
        "finalized_at": datetime.now(timezone.utc).isoformat(),
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.patch(
            f"{settings.SUPABASE_URL}/rest/v1/videos?id=eq.{video_id}",
            headers={**headers, "Prefer": "return=minimal"},
            json={"video_audit": video_audit_result},
        )
        if not resp.is_success:
            raise HTTPException(status_code=502, detail=f"DB update error: {resp.text}")

    return video_audit_result


@router.post("/api/classify_video_type")
async def classify_video_type(video_id: str, authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    await verify_jwt(authorization.split(" ", 1)[1])

    supabase_headers = {
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.get(
            f"{settings.SUPABASE_URL}/rest/v1/dataset_images"
            f"?video_id=eq.{video_id}&select=id,file_path,frame_timestamp&order=frame_timestamp.asc",
            headers=supabase_headers,
        )
        if not resp.is_success:
            raise HTTPException(status_code=502, detail=f"DB fetch error: {resp.text}")
        frames = resp.json()

    if not frames:
        raise HTTPException(status_code=404, detail="No frames found for this video")

    MAX_SAMPLES = 12
    if len(frames) <= MAX_SAMPLES:
        sampled = frames
    else:
        step = len(frames) / MAX_SAMPLES
        sampled = [frames[int(i * step)] for i in range(MAX_SAMPLES)]

    evidence: list[dict] = []
    model_used = VISION_MODELS[0]

    async with httpx.AsyncClient(timeout=90.0) as http_client:
        for frame in sampled:
            image_url = frame.get("file_path", "")
            ts = frame.get("frame_timestamp", 0)
            if not image_url:
                continue
            try:
                img_resp = await http_client.get(image_url, timeout=20.0)
                img_resp.raise_for_status()
                image_b64 = _b64.b64encode(img_resp.content).decode()
                image_b64 = _shrink_image(image_b64)
                frame_result, model_used = await call_vision_ai(
                    image_b64, preferred_model="", _prompt_override=VIDEO_CLASSIFY_PROMPT,
                )
                evidence.append({
                    "timestamp": ts,
                    "event": frame_result.get("action", "NONE"),
                    "active_box_id": frame_result.get("active_box_id"),
                    "box_state": frame_result.get("box_state", "UNKNOWN"),
                    "product_location": frame_result.get("product_location", "UNKNOWN"),
                    "product_visibility": frame_result.get("product_visibility", False),
                    "seal_state": frame_result.get("seal_state", "NOT_VISIBLE"),
                    "action": frame_result.get("action", "NONE"),
                    "confidence": frame_result.get("confidence", 0.0),
                    "notes": frame_result.get("notes", ""),
                })
            except Exception as e:
                evidence.append({
                    "timestamp": ts, "box_state": "UNKNOWN", "product_location": "UNKNOWN",
                    "seal_state": "NOT_VISIBLE", "action": "NONE", "event": "NONE", "notes": f"error: {e}",
                })

    video_type, confidence = _infer_video_type(evidence)
    classification = {
        "video_type": video_type, "confidence": confidence, "evidence": evidence,
        "model_used": model_used, "frame_count": len(sampled),
        "classified_at": datetime.now(timezone.utc).isoformat(),
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.patch(
            f"{settings.SUPABASE_URL}/rest/v1/videos?id=eq.{video_id}",
            headers={**supabase_headers, "Prefer": "return=minimal"},
            json={"video_type": video_type, "video_classification": classification},
        )
        if not resp.is_success:
            raise HTTPException(status_code=502, detail=f"DB update error: {resp.text}")

    return classification
