from __future__ import annotations

import asyncio
from typing import Any

import structlog

from workers.base_worker import BaseWorker
from workers.ocr_worker.processor import run_ocr

logger = structlog.get_logger(__name__)

OCR_QUEUE = "queue:ocr"


class OCRWorker(BaseWorker):
    """Worker that dequeues OCR jobs and processes video frames."""

    def __init__(self) -> None:
        super().__init__(queue_name=OCR_QUEUE)

    async def process(self, job: dict[str, Any]) -> None:
        frame_id: str = job["frame_id"]
        frame_path: str = job["frame_path"]
        video_id: str = job.get("video_id", "unknown")

        logger.info("Processing OCR job", frame_id=frame_id, video_id=video_id)

        result = await run_ocr(frame_id=frame_id, frame_path=frame_path)

        # TODO: Persist OCR result to database (update frame record with OCR data)
        # Example:
        #   async with get_session_factory()() as db:
        #       await update_frame_ocr(db, frame_id, result["regions"])

        logger.info(
            "OCR job finished",
            frame_id=frame_id,
            region_count=len(result["regions"]),
        )


async def main() -> None:
    worker = OCRWorker()
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
