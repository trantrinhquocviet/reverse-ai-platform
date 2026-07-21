from __future__ import annotations

import asyncio
import random
from typing import Any

import structlog

logger = structlog.get_logger(__name__)


async def run_ocr(frame_id: str, frame_path: str) -> dict[str, Any]:
    """Placeholder OCR processing logic.

    In production this would:
    - Load the frame image from storage
    - Run a Tesseract / PaddleOCR / custom model pass
    - Return structured text regions with bounding boxes

    TODO: Integrate real OCR engine
    """
    logger.info("Running OCR on frame", frame_id=frame_id, frame_path=frame_path)

    # Simulate processing time
    await asyncio.sleep(random.uniform(0.1, 0.5))

    # Simulated result
    simulated_regions = [
        {
            "text": "SAMPLE TEXT",
            "confidence": round(random.uniform(0.7, 0.99), 3),
            "bbox": {
                "x": round(random.uniform(0.0, 0.5), 3),
                "y": round(random.uniform(0.0, 0.5), 3),
                "w": round(random.uniform(0.1, 0.4), 3),
                "h": round(random.uniform(0.02, 0.1), 3),
            },
        }
        for _ in range(random.randint(0, 5))
    ]

    logger.info(
        "OCR complete",
        frame_id=frame_id,
        region_count=len(simulated_regions),
    )

    return {
        "frame_id": frame_id,
        "regions": simulated_regions,
        "engine": "placeholder",
    }
